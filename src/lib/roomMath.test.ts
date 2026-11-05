import { describe, expect, it } from "vitest";
import { calibrateFloor, clampInside, footprintCorners, outsideBy, overlaps, validQuad, type Pt, type V3 } from "@/lib/roomMath";

/* A ground-truth pinhole camera, built independently from the code under test. */
function truthCamera(pos: V3, target: V3, imgW: number, imgH: number, hfovDeg: number) {
  const f = imgW / 2 / Math.tan((hfovDeg * Math.PI) / 360);
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a: V3): V3 => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const fwd = unit(sub(target, pos));
  const right = unit(cross(fwd, [0, 1, 0]));
  const down = cross(fwd, right);
  return (p: V3): Pt => {
    const d = sub(p, pos);
    const x = dot(right, d), y = dot(down, d), z = dot(fwd, d);
    return { x: (f * x) / z + imgW / 2, y: (f * y) / z + imgH / 2 };
  };
}

const IMG_W = 1200, IMG_H = 800;
const W = 12, D = 10;

function setup(pos: V3, target: V3) {
  const cam = truthCamera(pos, target, IMG_W, IMG_H, 65);
  const corners = ([[0, 0], [W, 0], [W, D], [0, D]] as [number, number][]).map(([X, Z]) => cam([X, 0, Z]));
  return { cam, corners };
}

describe("calibrateFloor", () => {
  it("recovers the camera: points on the floor and up in the air land on the right pixels", () => {
    const { cam, corners } = setup([6, 5, 19], [6, 0.5, 4]);
    const cal = calibrateFloor(corners, W, D, IMG_W, IMG_H, 65)!;
    expect(cal).not.toBeNull();
    for (const p of [[3, 0, 4], [9, 0, 7], [6, 3, 5], [2, 2.8, 8], [10, 6, 1]] as V3[]) {
      const want = cam(p), got = cal.project(p);
      expect(Math.abs(got.x - want.x)).toBeLessThan(0.5);
      expect(Math.abs(got.y - want.y)).toBeLessThan(0.5);
    }
  });

  it("recovers the camera height and position", () => {
    const { corners } = setup([4, 5.5, 20], [6, 0, 4]);
    const cal = calibrateFloor(corners, W, D, IMG_W, IMG_H, 65)!;
    expect(cal.position[0]).toBeCloseTo(4, 1);
    expect(cal.position[1]).toBeCloseTo(5.5, 1);
    expect(cal.position[2]).toBeCloseTo(20, 1);
  });

  it("builds a Three.js camera matrix that projects the same way", () => {
    const { cam, corners } = setup([6, 5, 19], [6, 0.5, 4]);
    const cal = calibrateFloor(corners, W, D, IMG_W, IMG_H, 65)!;
    // invert the camera-to-world matrix by hand (rotation transpose) and project like Three.js does
    const m = cal.cameraMatrix;
    const R = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
    const pos: V3 = [m[12], m[13], m[14]];
    const p: V3 = [8, 2, 6];
    const d = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
    const cx = R[0][0] * d[0] + R[1][0] * d[1] + R[2][0] * d[2];
    const cy = R[0][1] * d[0] + R[1][1] * d[1] + R[2][1] * d[2];
    const cz = R[0][2] * d[0] + R[1][2] * d[1] + R[2][2] * d[2];
    expect(cz).toBeLessThan(0); // in front of a Three.js camera means negative z
    const u = (cal.f * cx) / -cz + IMG_W / 2;
    const v = IMG_H / 2 - (cal.f * cy) / -cz;
    const want = cam(p);
    expect(Math.abs(u - want.x)).toBeLessThan(0.5);
    expect(Math.abs(v - want.y)).toBeLessThan(0.5);
  });

  it("refuses a quad that is not convex", () => {
    const bad: Pt[] = [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 150, y: 300 }, { x: 600, y: 400 }];
    expect(validQuad(bad, IMG_W, IMG_H)).toBe(false);
    expect(calibrateFloor(bad, W, D, IMG_W, IMG_H)).toBeNull();
  });

  it("refuses a zero-size room and a tiny quad", () => {
    const { corners } = setup([6, 5, 19], [6, 0.5, 4]);
    expect(calibrateFloor(corners, 0, D, IMG_W, IMG_H)).toBeNull();
    const tiny: Pt[] = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }];
    expect(validQuad(tiny, IMG_W, IMG_H)).toBe(false);
  });
});

describe("footprints", () => {
  const sofa = { x: 3, z: 2, w: 6, d: 3, rot: 0 };

  it("returns the corners of an unrotated and a rotated rectangle", () => {
    expect(footprintCorners({ x: 0, z: 0, w: 2, d: 4, rot: 0 })).toEqual([[-1, -2], [1, -2], [1, 2], [-1, 2]]);
    const r = footprintCorners({ x: 0, z: 0, w: 2, d: 2, rot: Math.PI / 2 });
    expect(r[0][0]).toBeCloseTo(1, 6);
    expect(r[0][1]).toBeCloseTo(-1, 6);
  });

  it("detects overlap, including rotated pieces, and ignores touching edges", () => {
    expect(overlaps(sofa, { x: 3, z: 3, w: 2, d: 2, rot: 0 })).toBe(true);
    expect(overlaps(sofa, { x: 3, z: 5.5, w: 2, d: 2, rot: 0 })).toBe(false);
    expect(overlaps(sofa, { x: 3, z: 4, w: 2, d: 2, rot: 0 })).toBe(true); // sofa spans z 0.5 to 3.5, this spans 3 to 5
    expect(overlaps(sofa, { x: 3, z: 4.5, w: 2, d: 2, rot: 0 })).toBe(false); // edges just touch at z = 3.5
    expect(overlaps({ x: 0, z: 0, w: 4, d: 1, rot: 0 }, { x: 0, z: 0, w: 4, d: 1, rot: Math.PI / 2 })).toBe(true);
    expect(overlaps({ x: 0, z: 0, w: 4, d: 1, rot: 0 }, { x: 4, z: 4, w: 4, d: 1, rot: Math.PI / 4 })).toBe(false);
  });

  it("measures how far a piece sticks out of the floor and clamps it back in", () => {
    expect(outsideBy(sofa, W, D)).toBe(0);
    expect(outsideBy({ ...sofa, x: 1 }, W, D)).toBeCloseTo(2, 6); // 3 ft half width, centre at 1
    const fixed = clampInside({ ...sofa, x: 1, z: 20 }, W, D);
    expect(outsideBy(fixed, W, D)).toBeCloseTo(0, 6);
    expect(fixed.x).toBeCloseTo(3, 6);
    expect(fixed.z).toBeCloseTo(D - 1.5, 6);
  });
});
