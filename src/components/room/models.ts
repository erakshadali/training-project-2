import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ArtKind } from "@/data/products";
import type { DecorKind } from "@/lib/roomDecor";
import type { Dims } from "@/lib/roomDims";

/**
 * Soft, rounded 3D models for each kind of product and decor, built from rounded boxes, cylinders and spheres
 * so they load instantly and look the same everywhere. Each model is sized to the real dimensions (feet).
 * Origin is the centre of the footprint on the floor, +Y is up, and the front faces +Z.
 */

type Parts = { base: THREE.Color; dark: THREE.Color; light: THREE.Color };

function palette(tint: string): Parts {
  const base = new THREE.Color(tint);
  return {
    base,
    dark: base.clone().lerp(new THREE.Color("#000000"), 0.35),
    light: base.clone().lerp(new THREE.Color("#ffffff"), 0.4),
  };
}

type Extra = Partial<THREE.MeshStandardMaterialParameters>;

function mat(color: THREE.ColorRepresentation, extra: Extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, ...extra });
}

function place<T extends THREE.Mesh>(g: THREE.Object3D, m: T, x: number, y: number, z: number, shadow = true) {
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** A box with softly rounded edges. The radius is kept smaller than half the thinnest side. */
function rbox(g: THREE.Object3D, w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, r = 0.08, extra?: Extra) {
  const rad = Math.max(0.004, Math.min(r, Math.min(w, h, d) / 2 - 0.003));
  return place(g, new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rad), mat(color, extra)), x, y, z);
}

function cyl(g: THREE.Object3D, rTop: number, rBottom: number, h: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, rotX = 0, extra?: Extra, seg = 28) {
  const m = place(g, new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat(color, extra)), x, y, z);
  m.rotation.x = rotX;
  return m;
}

function ball(g: THREE.Object3D, r: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, extra?: Extra) {
  const m = place(g, new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(color, extra)), x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

const WOOD = "#7a5a3a";

type Build = (g: THREE.Group, p: Parts, d: Dims) => void;

const BUILD: Record<ArtKind | DecorKind, Build> = {
  bed(g, p, { w, d, h }) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.09, 0.07, 0.22, p.dark, sx * (w / 2 - 0.2), 0.11, sz * (d / 2 - 0.2));
    rbox(g, w, 0.7, d, p.dark, 0, 0.57, 0, 0.1);
    rbox(g, w - 0.18, 0.72, d - 0.3, "#f4efe6", 0, 1.28, 0.12, 0.24);
    rbox(g, w - 0.1, 0.2, d * 0.62, p.base, 0, 1.66, d * 0.17, 0.12);
    rbox(g, w + 0.06, h, 0.3, p.base, 0, h / 2, -d / 2 + 0.15, 0.14);
    for (const sx of [-1, 1]) {
      const pillow = rbox(g, w / 2 - 0.45, 0.42, 1.0, "#ffffff", sx * (w / 4), 1.84, -d / 2 + 0.95, 0.18);
      pillow.rotation.x = -0.12;
    }
  },

  sofa(g, p, { w, d, h }) {
    const arm = 0.72;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.11, 0.07, 0.24, WOOD, sx * (w / 2 - 0.32), 0.12, sz * (d / 2 - 0.32));
    rbox(g, w - 0.04, 0.9, d, p.dark, 0, 0.68, 0, 0.14);
    for (const sx of [-1, 1]) rbox(g, arm, 1.5, d, p.base, sx * (w / 2 - arm / 2), 1.0, 0, 0.32);
    const n = Math.max(2, Math.round((w - arm * 2) / 2.2));
    const cw = (w - arm * 2) / n;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + arm + cw * (i + 0.5);
      rbox(g, cw - 0.04, 0.58, d - 0.95, p.base, x, 1.34, 0.32, 0.22);
      const back = rbox(g, cw - 0.04, h - 1.3, 0.68, p.light, x, 1.64 + (h - 1.3) / 2 - 0.1, -d / 2 + 0.62, 0.28);
      back.rotation.x = -0.1;
    }
    rbox(g, w - arm * 2 + 0.2, h - 0.8, 0.3, p.dark, 0, 1.0 + (h - 0.8) / 2, -d / 2 + 0.2, 0.12);
    // two throw cushions
    const c1 = rbox(g, 0.95, 0.95, 0.32, "#f3e7d0", -w / 2 + arm + 0.7, 1.95, -d / 2 + 1.12, 0.14);
    c1.rotation.set(-0.35, 0.3, 0.12);
    const c2 = rbox(g, 0.9, 0.9, 0.3, "#d9703f", w / 2 - arm - 0.7, 1.9, -d / 2 + 1.1, 0.14);
    c2.rotation.set(-0.35, -0.25, -0.1);
  },

  dining(g, p, { w }) {
    const r = Math.max(1.2, w / 2 - 1.05);
    cyl(g, r, r, 0.14, p.light, 0, 2.5, 0, 0, undefined, 48);
    cyl(g, r + 0.02, r + 0.02, 0.05, p.dark, 0, 2.4, 0, 0, undefined, 48);
    cyl(g, 0.2, 0.26, 2.3, p.dark, 0, 1.2, 0);
    cyl(g, 0.72, 0.8, 0.12, p.dark, 0, 0.06, 0, 0, undefined, 36);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const chair = new THREE.Group();
      rbox(chair, 1.3, 0.24, 1.3, p.base, 0, 1.5, 0, 0.12);
      const back = rbox(chair, 1.3, 1.25, 0.18, p.base, 0, 2.2, -0.62, 0.1);
      back.rotation.x = -0.08;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(chair, 0.06, 0.045, 1.4, p.dark, sx * 0.55, 0.7, sz * 0.55);
      const dist = r + 0.65;
      chair.position.set(Math.sin(a) * dist, 0, Math.cos(a) * dist);
      chair.rotation.y = a + Math.PI; // each chair faces the table
      g.add(chair);
    }
  },

  desk(g, p, { w, d, h }) {
    rbox(g, w, 0.16, d, p.light, 0, h - 0.08, 0, 0.06);
    for (const sz of [-1, 1]) cyl(g, 0.07, 0.05, h - 0.16, p.dark, -(w / 2 - 0.2), (h - 0.16) / 2, sz * (d / 2 - 0.2));
    rbox(g, 1.35, h - 0.16, d - 0.12, p.base, w / 2 - 0.75, (h - 0.16) / 2, 0, 0.05);
    for (const y of [0.5, 1.15, 1.8]) {
      rbox(g, 1.2, 0.52, 0.04, p.light, w / 2 - 0.75, y, d / 2 - 0.04, 0.03);
      rbox(g, 0.4, 0.05, 0.05, p.dark, w / 2 - 0.75, y + 0.12, d / 2 + 0.01, 0.02);
    }
    // monitor, stand and keyboard
    rbox(g, 1.7, 1.0, 0.07, "#141d1b", -0.45, h + 0.82, -d / 2 + 0.5, 0.04);
    rbox(g, 1.6, 0.9, 0.02, "#2a8f86", -0.45, h + 0.82, -d / 2 + 0.55, 0.01, { emissive: new THREE.Color("#1d6f68"), emissiveIntensity: 0.5 });
    cyl(g, 0.05, 0.05, 0.3, "#141d1b", -0.45, h + 0.15, -d / 2 + 0.5);
    rbox(g, 0.7, 0.04, 0.4, "#141d1b", -0.45, h + 0.02, -d / 2 + 0.5, 0.02);
    rbox(g, 1.1, 0.06, 0.4, "#2b3230", -0.45, h + 0.03, d / 2 - 0.5, 0.03);
  },

  wardrobe(g, p, { w, d, h }) {
    rbox(g, w - 0.1, 0.25, d - 0.1, p.dark, 0, 0.125, 0, 0.04);
    rbox(g, w, h - 0.25, d, p.base, 0, 0.25 + (h - 0.25) / 2, 0, 0.07);
    for (const sx of [-1, 1]) {
      rbox(g, w / 2 - 0.1, h - 0.7, 0.06, p.light, sx * (w / 4), 0.25 + (h - 0.25) / 2, d / 2 + 0.02, 0.03);
      ball(g, 0.065, "#b9a37a", sx * 0.16, 0.25 + (h - 0.25) / 2, d / 2 + 0.09, 1, 1, 1, { metalness: 0.7, roughness: 0.3 });
    }
  },

  chair(g, p) {
    rbox(g, 1.7, 0.32, 1.6, p.base, 0, 1.68, 0.1, 0.15);
    const back = rbox(g, 1.5, 1.7, 0.28, p.base, 0, 2.75, -0.72, 0.16);
    back.rotation.x = -0.1;
    cyl(g, 0.08, 0.08, 1.3, "#33413d", 0, 1.0, 0.1);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Group();
      rbox(spoke, 1.0, 0.1, 0.14, "#33413d", 0.5, 0.22, 0, 0.04);
      ball(spoke, 0.1, "#1c2523", 1.0, 0.1, 0);
      spoke.rotation.y = (i * Math.PI * 2) / 5;
      spoke.position.set(0, 0, 0.1);
      g.add(spoke);
    }
  },

  shelf(g, p, { w, d, h }) {
    for (const sx of [-1, 1]) rbox(g, 0.09, h, d, p.dark, sx * (w / 2 - 0.045), h / 2, 0, 0.025);
    rbox(g, w, h, 0.04, p.dark, 0, h / 2, -d / 2 + 0.02, 0.01);
    const levels = 5;
    for (let i = 0; i <= levels; i++) rbox(g, w - 0.16, 0.09, d, p.light, 0, 0.1 + ((h - 0.2) / levels) * i, 0, 0.025);
    const colors = ["#e5603a", "#1f6b5b", "#f1b44c", "#46544f", "#b9855a"];
    for (let i = 0; i < levels; i++) {
      const y = 0.18 + ((h - 0.2) / levels) * i;
      if (i % 2 === 0) for (let k = 0; k < 4; k++) rbox(g, 0.14, 0.7 + (k % 2) * 0.2, 0.6, colors[(i + k) % 5], -w / 2 + 0.3 + k * 0.17, y + 0.4, 0, 0.025);
      else rbox(g, 0.4, 0.4, 0.4, p.base, w / 4, y + 0.24, 0, 0.1);
    }
  },

  fridge(g, p, { w, d, h }) {
    for (const sx of [-1, 1]) cyl(g, 0.08, 0.08, 0.12, "#2b3230", sx * (w / 2 - 0.25), 0.06, d / 2 - 0.25);
    rbox(g, w, h - 0.12, d, p.base, 0, 0.12 + (h - 0.12) / 2, 0, 0.13, { roughness: 0.4, metalness: 0.25 });
    rbox(g, w + 0.012, 0.03, d + 0.012, p.dark, 0, h * 0.68, 0, 0.012);
    for (const y of [h * 0.84, h * 0.45]) cyl(g, 0.04, 0.04, 0.8, "#aab6b4", w / 2 - 0.25, y, d / 2 + 0.08, 0, { metalness: 0.8, roughness: 0.25 });
  },

  washer(g, p, { w, d, h }) {
    rbox(g, w, h - 0.08, d, p.base, 0, 0.08 + (h - 0.08) / 2, 0, 0.12, { roughness: 0.4, metalness: 0.2 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 16, 40), mat("#2b3a38"));
    place(g, ring, 0, h * 0.45, d / 2 + 0.03);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 36), mat("#6fb6c9", { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
    glass.rotation.x = Math.PI / 2;
    place(g, glass, 0, h * 0.45, d / 2 + 0.02, false);
    rbox(g, w - 0.3, 0.32, 0.06, "#2b3a38", 0, h - 0.3, d / 2 + 0.03, 0.04);
    ball(g, 0.09, "#e5603a", w / 2 - 0.45, h - 0.3, d / 2 + 0.08);
  },

  tv(g, p, { w, h }) {
    rbox(g, 1.5, 0.07, 0.8, "#161f1d", 0, 0.035, 0, 0.03);
    cyl(g, 0.07, 0.09, 0.55, "#161f1d", 0, 0.34, 0);
    rbox(g, w, h - 0.5, 0.1, "#161f1d", 0, 0.5 + (h - 0.5) / 2, 0, 0.04);
    rbox(g, w - 0.14, h - 0.64, 0.02, "#2a8f86", 0, 0.5 + (h - 0.5) / 2, 0.06, 0.01, { emissive: new THREE.Color("#1d6f68"), emissiveIntensity: 0.55, roughness: 0.2 });
  },

  ac(g, p, { w, d, h, lift = 7 }) {
    rbox(g, w, h, d, "#f2f5f6", 0, lift + h / 2, 0, 0.2, { roughness: 0.5 });
    rbox(g, w - 0.4, 0.07, 0.07, "#7d8a88", 0, lift + 0.2, d / 2 - 0.02, 0.03);
    rbox(g, w - 0.3, 0.26, 0.03, p.base.clone().lerp(new THREE.Color("#ffffff"), 0.2), 0, lift + h * 0.78, d / 2 + 0.01, 0.03);
    ball(g, 0.045, "#2fd27a", w / 2 - 0.35, lift + h * 0.78, d / 2 + 0.04, 1, 1, 0.6, { emissive: new THREE.Color("#2fd27a"), emissiveIntensity: 0.9 });
  },

  microwave(g, p, { w, d, h }) {
    rbox(g, w, 1.7, d, p.light, 0, 0.85, 0, 0.07);
    rbox(g, w - 0.1, 0.05, d - 0.1, p.dark, 0, 1.72, 0, 0.02);
    const mh = h - 1.75;
    rbox(g, w, mh, d * 0.9, p.base, 0, 1.75 + mh / 2, 0, 0.1);
    rbox(g, w * 0.62, mh * 0.78, 0.03, "#141d1b", -w * 0.12, 1.75 + mh / 2, d * 0.45 + 0.02, 0.03, { roughness: 0.15 });
    ball(g, 0.12, p.dark, w * 0.36, 1.75 + mh * 0.68, d * 0.45 + 0.04, 1, 1, 0.45);
  },

  purifier(g, p, { w, d, h }) {
    rbox(g, w - 0.1, 1.6, d - 0.1, p.light, 0, 0.8, 0, 0.12);
    const uh = h - 1.6;
    rbox(g, w, uh, d, p.base, 0, 1.6 + uh / 2, 0, 0.28, { roughness: 0.35 });
    rbox(g, w * 0.6, uh * 0.3, 0.03, "#ffffff", 0, 1.6 + uh * 0.68, d / 2 + 0.01, 0.02);
    ball(g, 0.05, "#1f6b5b", 0, 1.6 + uh * 0.2, d / 2 + 0.03, 1, 1, 0.5, { emissive: new THREE.Color("#1f6b5b"), emissiveIntensity: 0.6 });
  },

  // ------------------------------- decor -------------------------------

  rug(g, p, { w, d }) {
    const outer = rbox(g, w, 0.05, d, p.base, 0, 0.025, 0, 0.02, { roughness: 1 });
    outer.castShadow = false;
    const band = rbox(g, w - 0.5, 0.058, d - 0.5, p.light, 0, 0.029, 0, 0.02, { roughness: 1 });
    band.castShadow = false;
    const core = rbox(g, w - 1.2, 0.064, d - 1.2, p.base, 0, 0.032, 0, 0.02, { roughness: 1 });
    core.castShadow = false;
    for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) {
      const tassel = rbox(g, 0.05, 0.03, 0.22, p.light, -w / 2 + 0.5 + (i * (w - 1)) / 5, 0.02, sz * (d / 2 + 0.1), 0.01, { roughness: 1 });
      tassel.castShadow = false;
    }
  },

  plant(g, p, { h }) {
    cyl(g, 0.52, 0.38, 0.95, "#b4532a", 0, 0.475, 0, 0, { roughness: 0.9 }, 32);
    cyl(g, 0.56, 0.56, 0.12, "#a24a24", 0, 0.95, 0, 0, { roughness: 0.9 }, 32);
    cyl(g, 0.47, 0.47, 0.03, "#3a2a1e", 0, 1.0, 0, 0, undefined, 32);
    const leaf = p.base;
    for (let i = 0; i < 16; i++) {
      const a = i * 2.399963; // golden angle spreads the leaves evenly
      const ring = 0.18 + (i % 4) * 0.1;
      const y = 1.55 + ((i * 37) % 10) * ((h - 2.2) / 10);
      const shade = i % 3 === 0 ? leaf.clone().lerp(new THREE.Color("#ffffff"), 0.18) : i % 3 === 1 ? leaf : leaf.clone().lerp(new THREE.Color("#000000"), 0.2);
      const l = ball(g, 0.2, shade, Math.cos(a) * ring, y, Math.sin(a) * ring, 0.75, 2.6 + (i % 3) * 0.4, 0.3, { roughness: 0.7 });
      l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
  },

  mirror(g, p, { w, h, lift = 3.4 }) {
    const r = w / 2;
    const frameGeo = new THREE.CylinderGeometry(r, r, 0.1, 8);
    frameGeo.rotateX(Math.PI / 2);
    frameGeo.rotateZ(Math.PI / 8);
    place(g, new THREE.Mesh(frameGeo, mat(p.base, { metalness: 0.75, roughness: 0.3 })), 0, lift + h / 2, 0);
    const glassGeo = new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.08, 8);
    glassGeo.rotateX(Math.PI / 2);
    glassGeo.rotateZ(Math.PI / 8);
    place(g, new THREE.Mesh(glassGeo, mat("#e3f0f5", { metalness: 0.6, roughness: 0.1, emissive: new THREE.Color("#a9c8d4"), emissiveIntensity: 0.6 })), 0, lift + h / 2, 0.03, false);
    ball(g, 0.07, p.base, 0, lift + h - 0.05, 0.02, 1, 1, 0.6, { metalness: 0.75, roughness: 0.3 });
  },

  coffee(g, p, { w, d, h }) {
    rbox(g, w, 0.13, d, p.light, 0, h - 0.065, 0, 0.06);
    rbox(g, w - 0.35, 0.08, d - 0.35, p.base, 0, 0.42, 0, 0.03);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.075, 0.05, h - 0.13, p.dark, sx * (w / 2 - 0.2), (h - 0.13) / 2, sz * (d / 2 - 0.2));
    rbox(g, 0.75, 0.09, 0.55, "#2b5d78", -0.5, h + 0.045, 0.1, 0.02);
    rbox(g, 0.7, 0.06, 0.5, "#e5603a", -0.5, h + 0.12, 0.1, 0.02);
    cyl(g, 0.13, 0.1, 0.22, "#f7f3ec", 0.7, h + 0.11, -0.1);
  },

  lamp(g, p, { w, h }) {
    cyl(g, w * 0.4, w * 0.42, 0.07, "#2b3230", 0, 0.035, 0);
    cyl(g, 0.035, 0.035, h - 1.1, "#2b3230", 0, 0.07 + (h - 1.1) / 2, 0);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.95, 28, 1, true), mat(p.base, { emissive: p.base, emissiveIntensity: 0.55, side: THREE.DoubleSide, roughness: 0.9 }));
    place(g, shade, 0, h - 0.55, 0, false);
    ball(g, 0.14, "#fff3cf", 0, h - 0.7, 0, 1, 1, 1, { emissive: new THREE.Color("#ffe9a8"), emissiveIntensity: 1 });
  },
};

export function buildModel(art: ArtKind | DecorKind, tint: string, dims: Dims): THREE.Group {
  const group = new THREE.Group();
  BUILD[art](group, palette(tint), dims);
  return group;
}

export function disposeModel(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}
