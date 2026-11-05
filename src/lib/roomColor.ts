import type { Dims } from "@/lib/roomDims";
import { isWallMounted } from "@/lib/roomDims";
import type { Pt } from "@/lib/roomMath";

/** Colour reading and furniture scoring for Room Studio. Pure functions, unit tested. */

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: RGB) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** CIE L*a*b* from sRGB, for perceptual colour distance. */
export function rgbToLab([r, g, b]: RGB): [number, number, number] {
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: RGB, b: RGB) {
  const [l1, a1, b1] = rgbToLab(a), [l2, a2, b2] = rgbToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Hue 0..360, saturation 0..1, lightness 0..1. */
export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const isNeutral = ([, s, l]: [number, number, number]) => s < 0.18 || l < 0.12 || l > 0.9;

/** A plain-language name such as "dark green" or "light warm grey". */
export function colorName(rgb: RGB): string {
  const [h, s, l] = rgbToHsl(rgb);
  const tone = l < 0.25 ? "dark " : l > 0.78 ? "light " : "";
  if (l < 0.1) return "black";
  if (l > 0.93 && s < 0.2) return "white";
  if (s < 0.12) return tone + "grey";
  const names: [number, string][] = [[15, "red"], [40, "orange"], [65, "yellow"], [160, "green"], [200, "teal"], [255, "blue"], [290, "purple"], [335, "pink"], [361, "red"]];
  const name = names.find(([max]) => h < max)![1];
  const warm = s < 0.55 && h >= 15 && h < 55 ? (l > 0.55 ? "beige" : "brown") : name;
  return tone + warm;
}

function median(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)] ?? 0;
}

function pointInQuad(p: Pt, q: Pt[]) {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    if (q[i].y > p.y !== q[j].y > p.y && p.x < ((q[j].x - q[i].x) * (p.y - q[i].y)) / (q[j].y - q[i].y) + q[i].x) inside = !inside;
  }
  return inside;
}

/**
 * Read the floor colour (inside the marked floor) and the wall colour (the band above the back edge)
 * from raw RGBA pixel data. Uses medians so a rug, a window or a shadow does not skew the result.
 */
export function readRoomColors(data: Uint8ClampedArray | number[], width: number, height: number, quad: Pt[]): { floor: RGB; wall: RGB } {
  const floorPx: RGB[] = [];
  const wallPx: RGB[] = [];
  const backY = Math.min(quad[0].y, quad[1].y);
  const step = Math.max(2, Math.floor(Math.min(width, height) / 90));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const px: RGB = [data[i], data[i + 1], data[i + 2]];
      if (pointInQuad({ x, y }, quad)) floorPx.push(px);
      else if (y < backY - 4) wallPx.push(px);
    }
  }
  const pick = (px: RGB[], fallback: RGB): RGB => (px.length ? [median(px.map((p) => p[0])), median(px.map((p) => p[1])), median(px.map((p) => p[2]))] : fallback);
  return { floor: pick(floorPx, [150, 150, 150]), wall: pick(wallPx, [225, 225, 225]) };
}

export type ColorScore = { score: number; label: "Great match" | "Good match" | "Weak match"; reason: string };

/**
 * Score how well a product colour suits the room, 0 to 100. This is a design rule of thumb, not a guarantee:
 * 40 points for standing out from the floor, 30 for a pleasing hue relation with the walls
 * (neutral, same family or opposite), 30 for a light or dark contrast with the walls.
 */
export function scoreColor(tintHex: string, floor: RGB, wall: RGB): ColorScore {
  const tint = hexToRgb(tintHex);
  const de = deltaE(tint, floor);
  const a = Math.min(de / 30, 1) * 40;

  const ht = rgbToHsl(tint), hw = rgbToHsl(wall);
  let b: number;
  let harmony: string;
  if (isNeutral(ht) || isNeutral(hw)) {
    b = 26;
    harmony = isNeutral(ht) ? "a neutral tone that suits any wall" : "your neutral walls let the colour take the lead";
  } else {
    const raw = Math.abs(ht[0] - hw[0]);
    const dh = Math.min(raw, 360 - raw);
    if (dh <= 30) { b = 30; harmony = "it sits in the same colour family as your walls"; }
    else if (dh >= 150) { b = 27; harmony = "it is a classic opposite to your wall colour"; }
    else if (dh >= 90) { b = 18; harmony = "it is a bold choice against your wall colour"; }
    else { b = 12; harmony = "it is close to your wall colour without matching it"; }
  }
  const c = Math.min(Math.abs(ht[2] - hw[2]) / 0.4, 1) * 30;

  const score = Math.round(Math.min(100, a + b + c));
  const contrast = de >= 25 ? "stands out clearly against your floor" : de >= 14 ? "shows up against your floor" : "blends into your floor";
  const label = score >= 72 ? "Great match" : score >= 52 ? "Good match" : "Weak match";
  return { score, label, reason: `${capital(colorName(tint))} ${contrast}, and ${harmony}.` };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Fit = { status: "Fits well" | "Tight fit" | "Too big"; note: string };

/** Can this product sit comfortably in a room of this size? */
export function sizeFit(dims: Dims, W: number, D: number): Fit {
  if (isWallMounted(dims)) return { status: "Fits well", note: "Mounted high on a wall, so it takes no floor space." };
  const area = (dims.w * dims.d) / (W * D);
  const along = Math.min(dims.w, dims.d) > W - 1 || Math.max(dims.w, dims.d) > Math.max(W, D) - 1;
  if (along || area > 0.35) return { status: "Too big", note: `At ${dims.w} by ${dims.d} ft it would take over most of a ${W} by ${D} ft room.` };
  if (area > 0.2 || dims.w / W > 0.7) return { status: "Tight fit", note: `Takes ${Math.round(area * 100)}% of the floor. Leave space to walk around it.` };
  return { status: "Fits well", note: `Takes ${Math.round(area * 100)}% of the floor.` };
}

export type Crowding = { percent: number; verdict: "Roomy" | "Balanced" | "Getting crowded" | "Too crowded" };

/** How much of the floor the placed furniture covers. */
export function crowding(items: { w: number; d: number; wallMounted?: boolean }[], W: number, D: number): Crowding {
  const used = items.filter((i) => !i.wallMounted).reduce((s, i) => s + i.w * i.d, 0);
  const percent = Math.round((used / (W * D)) * 100);
  const verdict = percent < 25 ? "Roomy" : percent < 40 ? "Balanced" : percent < 55 ? "Getting crowded" : "Too crowded";
  return { percent, verdict };
}
