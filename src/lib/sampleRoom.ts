import type { Pt } from "@/lib/roomMath";

/**
 * Draws an empty hall as a picture, using a real pinhole camera, so Room Studio can be tried without a photo.
 * Because we know the camera, we also know exactly where the four floor corners are.
 */

export type SampleRoom = { url: string; width: number; height: number; quad: Pt[]; W: number; D: number; hfov: number };

const IW = 1200, IH = 800, HFOV = 65;
const ROOM_W = 12, ROOM_D = 9, WALL_H = 9;
const CAM: [number, number, number] = [6, 5.6, 20];
const TARGET: [number, number, number] = [6, 0.8, 3.6];

function camera() {
  const f = IW / 2 / Math.tan((HFOV * Math.PI) / 360);
  const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
  const cr = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const un = (a: number[]) => { const n = Math.hypot(...a); return a.map((v) => v / n); };
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const fw = un(sub(TARGET, CAM));
  const rt = un(cr(fw, [0, 1, 0]));
  const dn = cr(fw, rt);
  return (p: number[]): Pt => {
    const d = sub(p, CAM);
    const z = dot(fw, d);
    return { x: (f * dot(rt, d)) / z + IW / 2, y: (f * dot(dn, d)) / z + IH / 2 };
  };
}

export function makeSampleRoom(): SampleRoom {
  const cam = camera();
  const canvas = document.createElement("canvas");
  canvas.width = IW;
  canvas.height = IH;
  const ctx = canvas.getContext("2d")!;
  const W = ROOM_W, D = ROOM_D, H = WALL_H;

  const poly = (pts: number[][], fill: string | CanvasGradient, stroke?: string, width = 1) => {
    ctx.beginPath();
    pts.map(cam).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  };
  const line = (a: number[], b: number[], color: string, width = 1) => {
    const p = cam(a), q = cam(b);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };

  ctx.fillStyle = "#e8e3d8";
  ctx.fillRect(0, 0, IW, IH);

  // ceiling, walls
  poly([[0, H, 0], [W, H, 0], [W, H, D], [0, H, D]], "#f5f2eb");
  const back = ctx.createLinearGradient(0, 0, 0, 420);
  back.addColorStop(0, "#ece7dc"); back.addColorStop(1, "#e1dbcd");
  poly([[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0]], back);
  poly([[0, 0, 0], [0, 0, D], [0, H, D], [0, H, 0]], "#d9d3c5");
  poly([[W, 0, 0], [W, 0, D], [W, H, D], [W, H, 0]], "#e0dacd");

  // window on the back wall
  poly([[3.4, 3, 0], [8.6, 3, 0], [8.6, 7.3, 0], [3.4, 7.3, 0]], "#f4f1ea", "#bdb6a6", 3);
  poly([[3.65, 3.25, 0], [8.35, 3.25, 0], [8.35, 7.05, 0], [3.65, 7.05, 0]], "#cfe6f5");
  line([6, 3.25, 0], [6, 7.05, 0], "#f4f1ea", 5);
  line([3.65, 5.15, 0], [8.35, 5.15, 0], "#f4f1ea", 5);
  poly([[3.65, 3.25, 0], [6, 3.25, 0], [4.9, 7.05, 0], [3.65, 7.05, 0]], "rgba(255,255,255,0.35)");

  // floor: light oak planks
  const floor = ctx.createLinearGradient(0, 380, 0, 600);
  floor.addColorStop(0, "#cdb48f"); floor.addColorStop(1, "#d8c19c");
  poly([[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]], floor);
  for (let x = 0.6; x < W; x += 0.6) line([x, 0, 0], [x, 0, D], "rgba(110,80,45,0.22)", 1.2);
  const rng = (n: number) => { const s = Math.sin(n * 91.7) * 43758.5; return s - Math.floor(s); };
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng(i) * (W / 0.6)) * 0.6;
    const z = rng(i + 100) * D;
    line([x, 0, z], [x + 0.6, 0, z], "rgba(110,80,45,0.18)", 1);
  }
  // soft light from the window
  poly([[4.2, 0, 0.2], [7.8, 0, 0.2], [8.6, 0, 4.5], [3.4, 0, 4.5]], "rgba(255,250,230,0.16)");

  // baseboards
  poly([[0, 0, 0], [W, 0, 0], [W, 0.45, 0], [0, 0.45, 0]], "#f6f3ec", "#cfc8b8");
  poly([[0, 0, 0], [0, 0, D], [0, 0.45, D], [0, 0.45, 0]], "#efebe2");
  poly([[W, 0, 0], [W, 0, D], [W, 0.45, D], [W, 0.45, 0]], "#f1ede4");

  // a wall light and a door on the right wall
  poly([[W, 0, 3], [W, 0, 5.6], [W, 7, 5.6], [W, 7, 3]], "#d8cfbe", "#b9ae98", 3);
  poly([[W, 0.2, 3.3], [W, 0.2, 5.3], [W, 6.7, 5.3], [W, 6.7, 3.3]], "#e6ddca");

  const quad = ([[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]] as number[][]).map(cam);
  return { url: canvas.toDataURL("image/jpeg", 0.9), width: IW, height: IH, quad, W, D, hfov: HFOV };
}
