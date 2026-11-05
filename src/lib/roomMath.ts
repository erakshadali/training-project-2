/**
 * Geometry for Room Studio. Pure functions, no browser or Three.js needed, so they can be unit tested.
 *
 * World axes (feet): X runs left to right along the back wall, Z runs from the back wall towards the
 * viewer, Y is up. The floor is the rectangle 0..W by 0..D at Y = 0.
 * The customer marks the four floor corners on the photo (back-left, back-right, front-right, front-left).
 * From them we recover where the camera must have been, so 3D furniture can be drawn in the same
 * perspective and at the right size.
 */

export type Pt = { x: number; y: number };
export type V3 = [number, number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3) => Math.sqrt(dot(a, a));
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => scale(a, 1 / (norm(a) || 1));

/** Solves A x = b by Gaussian elimination with partial pivoting. Returns null if the system is singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Homography (3x3, row-major, h33 = 1) mapping floor coordinates (X, Z) to photo pixels. */
export function floorHomography(W: number, D: number, img: Pt[]): number[] | null {
  if (img.length !== 4) return null;
  const src: [number, number][] = [[0, 0], [W, 0], [W, D], [0, D]];
  const A: number[][] = [];
  const b: number[] = [];
  src.forEach(([X, Z], i) => {
    const { x: u, y: v } = img[i];
    A.push([X, Z, 1, 0, 0, 0, -u * X, -u * Z]);
    b.push(u);
    A.push([0, 0, 0, X, Z, 1, -v * X, -v * Z]);
    b.push(v);
  });
  const h = solve(A, b);
  return h ? [...h, 1] : null;
}

/** True when the four points form a convex quadrilateral in the expected order with a sensible area. */
export function validQuad(q: Pt[], imgW: number, imgH: number): boolean {
  if (q.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-6) return false;
    const s = Math.sign(z);
    if (sign && s !== sign) return false;
    sign = s;
  }
  let area = 0;
  for (let i = 0; i < 4; i++) area += q[i].x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * q[i].y;
  return Math.abs(area) / 2 > imgW * imgH * 0.01;
}

export type Calibration = {
  /** focal length in pixels */
  f: number;
  /** vertical field of view in degrees, for the Three.js camera */
  vfov: number;
  /** project a world point (feet) to photo pixels */
  project: (p: V3) => Pt;
  /** column-major 4x4 camera-to-world matrix for Three.js (camera looks down -Z, +Y up) */
  cameraMatrix: number[];
  /** camera position in feet (Y is height above the floor) */
  position: V3;
};

/**
 * Recover the camera from the four floor corners.
 * @param hfovDeg horizontal field of view of the photo. Phone cameras are usually 60 to 75 degrees.
 */
export function calibrateFloor(corners: Pt[], W: number, D: number, imgW: number, imgH: number, hfovDeg = 65): Calibration | null {
  if (W <= 0 || D <= 0 || !validQuad(corners, imgW, imgH)) return null;
  const H = floorHomography(W, D, corners);
  if (!H) return null;

  const f = imgW / 2 / Math.tan(rad(hfovDeg / 2));
  const cx = imgW / 2, cy = imgH / 2;
  const col = (j: number): V3 => [H[j], H[3 + j], H[6 + j]];
  const kinv = (p: V3): V3 => [(p[0] - cx * p[2]) / f, (p[1] - cy * p[2]) / f, p[2]];
  const g1 = kinv(col(0)), g2 = kinv(col(1)), g3 = kinv(col(2));

  const lambda = 2 / (norm(g1) + norm(g2));
  let r1 = scale(g1, lambda), r2 = scale(g2, lambda), t = scale(g3, lambda);
  if (t[2] < 0) { r1 = scale(r1, -1); r2 = scale(r2, -1); t = scale(t, -1); }

  // Make the rotation exactly orthonormal.
  r1 = unit(r1);
  r2 = unit(sub(r2, scale(r1, dot(r1, r2))));
  const r3 = cross(r1, r2);

  // Camera (OpenCV style: x right, y down, z forward) coordinates of a world point (X, Y up, Z).
  // The floor normal r3 points into the floor, so world "up" is -r3.
  const up = scale(r3, -1);
  const toCam = (p: V3): V3 => [
    p[0] * r1[0] + p[1] * up[0] + p[2] * r2[0] + t[0],
    p[0] * r1[1] + p[1] * up[1] + p[2] * r2[1] + t[1],
    p[0] * r1[2] + p[1] * up[2] + p[2] * r2[2] + t[2],
  ];

  // Convert to Three.js camera conventions (y up, looks down -z): flip y and z.
  const Rm = [
    [r1[0], up[0], r2[0]],
    [-r1[1], -up[1], -r2[1]],
    [-r1[2], -up[2], -r2[2]],
  ];
  const tm: V3 = [t[0], -t[1], -t[2]];
  // camera-to-world rotation is the transpose; position = -R^T t
  const Rc = [
    [Rm[0][0], Rm[1][0], Rm[2][0]],
    [Rm[0][1], Rm[1][1], Rm[2][1]],
    [Rm[0][2], Rm[1][2], Rm[2][2]],
  ];
  const position: V3 = [
    -(Rc[0][0] * tm[0] + Rc[0][1] * tm[1] + Rc[0][2] * tm[2]),
    -(Rc[1][0] * tm[0] + Rc[1][1] * tm[1] + Rc[1][2] * tm[2]),
    -(Rc[2][0] * tm[0] + Rc[2][1] * tm[1] + Rc[2][2] * tm[2]),
  ];
  // The camera must be above the floor and every corner must be in front of it.
  if (position[1] <= 0) return null;
  for (const [X, Z] of [[0, 0], [W, 0], [W, D], [0, D]]) if (toCam([X, 0, Z])[2] <= 0) return null;

  const cameraMatrix = [
    Rc[0][0], Rc[1][0], Rc[2][0], 0,
    Rc[0][1], Rc[1][1], Rc[2][1], 0,
    Rc[0][2], Rc[1][2], Rc[2][2], 0,
    position[0], position[1], position[2], 1,
  ];

  return {
    f,
    vfov: (2 * Math.atan(imgH / 2 / f) * 180) / Math.PI,
    position,
    cameraMatrix,
    project: (p) => {
      const c = toCam(p);
      return { x: (f * c[0]) / c[2] + cx, y: (f * c[1]) / c[2] + cy };
    },
  };
}

/* ------------------------------ footprints ------------------------------ */

export type Footprint = { x: number; z: number; w: number; d: number; rot: number };

/** The four floor corners of a rotated rectangle. rot is in radians around the vertical axis. */
export function footprintCorners({ x, z, w, d, rot }: Footprint): [number, number][] {
  const c = Math.cos(rot), s = Math.sin(rot);
  return ([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] as [number, number][]).map(([px, pz]) => [
    x + px * c - pz * s,
    z + px * s + pz * c,
  ]);
}

/** Separating axis test for two rotated rectangles. Touching edges do not count as overlap. */
export function overlaps(a: Footprint, b: Footprint, tolerance = 0.02): boolean {
  const pa = footprintCorners(a), pb = footprintCorners(b);
  const axes: [number, number][] = [];
  for (const poly of [pa, pb]) {
    for (let i = 0; i < 2; i++) {
      const p = poly[i], q = poly[i + 1];
      axes.push([-(q[1] - p[1]), q[0] - p[0]]);
    }
  }
  for (const [ax, az] of axes) {
    const len = Math.hypot(ax, az) || 1;
    const proj = (poly: [number, number][]) => {
      const v = poly.map(([px, pz]) => (px * ax + pz * az) / len);
      return [Math.min(...v), Math.max(...v)];
    };
    const [a0, a1] = proj(pa), [b0, b1] = proj(pb);
    if (a1 <= b0 + tolerance || b1 <= a0 + tolerance) return false;
  }
  return true;
}

/** How far a footprint pokes outside the floor rectangle, in feet (0 when fully inside). */
export function outsideBy(fp: Footprint, W: number, D: number): number {
  let worst = 0;
  for (const [px, pz] of footprintCorners(fp)) {
    worst = Math.max(worst, -px, px - W, -pz, pz - D);
  }
  return Math.max(0, worst);
}

/** Keep a footprint inside the floor by sliding its centre. */
export function clampInside(fp: Footprint, W: number, D: number): Footprint {
  const pts = footprintCorners(fp);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const halfX = (Math.max(...xs) - Math.min(...xs)) / 2;
  const halfZ = (Math.max(...zs) - Math.min(...zs)) / 2;
  return {
    ...fp,
    x: Math.min(Math.max(fp.x, halfX), Math.max(halfX, W - halfX)),
    z: Math.min(Math.max(fp.z, halfZ), Math.max(halfZ, D - halfZ)),
  };
}
