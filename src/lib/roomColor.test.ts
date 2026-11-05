import { describe, expect, it } from "vitest";
import { colorName, crowding, deltaE, hexToRgb, readRoomColors, rgbToHex, rgbToHsl, scoreColor, sizeFit, type RGB } from "@/lib/roomColor";

describe("colour basics", () => {
  it("converts hex to RGB and back", () => {
    expect(hexToRgb("#2f6f62")).toEqual([47, 111, 98]);
    expect(rgbToHex([47, 111, 98])).toBe("#2f6f62");
  });

  it("measures colour distance: same is 0, black to white is large, near colours are small", () => {
    expect(deltaE([120, 120, 120], [120, 120, 120])).toBe(0);
    expect(deltaE([0, 0, 0], [255, 255, 255])).toBeGreaterThan(90);
    expect(deltaE([200, 200, 200], [205, 205, 205])).toBeLessThan(5);
  });

  it("finds hue, saturation and lightness", () => {
    const [h, s, l] = rgbToHsl([255, 0, 0]);
    expect(h).toBe(0);
    expect(s).toBe(1);
    expect(l).toBeCloseTo(0.5, 5);
    expect(rgbToHsl([128, 128, 128])[1]).toBe(0);
  });

  it("names colours in plain words", () => {
    expect(colorName([20, 20, 20])).toBe("black");
    expect(colorName([250, 250, 250])).toBe("white");
    expect(colorName([47, 111, 98])).toMatch(/teal|green/);
    expect(colorName([200, 40, 40])).toBe("red");
    expect(colorName([205, 180, 143])).toBe("beige"); // light oak floor
    expect(colorName([120, 85, 55])).toBe("brown");
  });
});

describe("readRoomColors", () => {
  // 100 x 100 image: wall (light blue) on top 40 rows, floor (brown) below
  const W = 100, H = 100;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const px: RGB = y < 40 ? [200, 220, 240] : [150, 100, 60];
    data[i] = px[0]; data[i + 1] = px[1]; data[i + 2] = px[2]; data[i + 3] = 255;
  }
  const quad = [{ x: 20, y: 45 }, { x: 80, y: 45 }, { x: 95, y: 95 }, { x: 5, y: 95 }];

  it("reads the wall in front of the camera, not the ceiling above it", () => {
    // dark ceiling on the top 25 rows, light wall on rows 25 to 39, floor below
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const px: RGB = y < 25 ? [60, 40, 30] : y < 40 ? [235, 232, 222] : [150, 100, 60];
      d[i] = px[0]; d[i + 1] = px[1]; d[i + 2] = px[2]; d[i + 3] = 255;
    }
    expect(readRoomColors(d, W, H, quad).wall).toEqual([235, 232, 222]);
  });

  it("reads the floor from inside the marked quad and the wall from above it", () => {
    const { floor, wall } = readRoomColors(data, W, H, quad);
    expect(floor).toEqual([150, 100, 60]);
    expect(wall).toEqual([200, 220, 240]);
  });

  it("ignores a small rug: the median stays the floor colour", () => {
    const copy = new Uint8ClampedArray(data);
    for (let y = 60; y < 70; y++) for (let x = 40; x < 50; x++) { const i = (y * W + x) * 4; copy[i] = 200; copy[i + 1] = 0; copy[i + 2] = 0; }
    expect(readRoomColors(copy, W, H, quad).floor).toEqual([150, 100, 60]);
  });
});

describe("scoreColor", () => {
  const lightFloor: RGB = [215, 205, 190];
  const whiteWall: RGB = [240, 240, 240];

  it("rates a dark teal sofa as a good match for a light floor and white walls", () => {
    const r = scoreColor("#2f6f62", lightFloor, whiteWall);
    expect(r.score).toBeGreaterThanOrEqual(72);
    expect(r.label).toBe("Great match");
    expect(r.reason).toMatch(/stands out/);
  });

  it("rates a sofa the same colour as the floor as a weak match", () => {
    const r = scoreColor("#d7cdbe", lightFloor, whiteWall);
    expect(r.label).toBe("Weak match");
    expect(r.reason).toMatch(/blends into your floor/);
  });

  it("always stays between 0 and 100", () => {
    for (const hex of ["#000000", "#ffffff", "#e5603a", "#2f6f62", "#b9855a"]) {
      const s = scoreColor(hex, lightFloor, whiteWall).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("gives colourful walls a harmony reason", () => {
    const sage: RGB = [160, 190, 160];
    expect(scoreColor("#3f7a45", [120, 90, 70], sage).reason).toMatch(/same colour family/);
    expect(scoreColor("#9a3fa0", [120, 90, 70], sage).reason).toMatch(/opposite/);
  });
});

describe("sizeFit and crowding", () => {
  it("says a 3-seater sofa fits a 12 x 10 hall but is too big for a 7 x 6 room", () => {
    expect(sizeFit({ w: 7, d: 3, h: 2.8 }, 12, 10).status).toBe("Fits well");
    expect(sizeFit({ w: 7, d: 3, h: 2.8 }, 7, 6).status).toBe("Too big");
  });

  it("calls a queen bed in a small room a tight fit or too big, and a wall AC always fine", () => {
    expect(["Tight fit", "Too big"]).toContain(sizeFit({ w: 5, d: 6.5, h: 3.3 }, 10, 9).status);
    expect(sizeFit({ w: 3, d: 0.9, h: 1, lift: 7 }, 6, 6).status).toBe("Fits well");
  });

  it("measures how crowded the floor is", () => {
    expect(crowding([], 12, 10)).toEqual({ percent: 0, verdict: "Roomy" });
    expect(crowding([{ w: 7, d: 3 }, { w: 4, d: 2 }], 12, 10).verdict).toBe("Roomy");
    expect(crowding([{ w: 7, d: 3 }, { w: 5, d: 6.5 }], 12, 10).verdict).toBe("Getting crowded");
    expect(crowding([{ w: 12, d: 10 }], 12, 10).verdict).toBe("Too crowded");
    expect(crowding([{ w: 3, d: 1, wallMounted: true }], 12, 10).percent).toBe(0);
  });
});
