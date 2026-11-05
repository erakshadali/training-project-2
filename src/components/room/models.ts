import * as THREE from "three";
import type { ArtKind } from "@/data/products";
import type { Dims } from "@/lib/roomDims";

/**
 * Simple, clean 3D models for each kind of product, built from boxes and cylinders so they load instantly
 * and look the same everywhere. Each model is sized to the product's real dimensions (feet).
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

function mat(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, ...extra });
}

function box(g: THREE.Group, w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function cyl(g: THREE.Group, rTop: number, rBottom: number, h: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, rotX = 0, extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 28), mat(color, extra));
  m.position.set(x, y, z);
  m.rotation.x = rotX;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

const BUILD: Record<ArtKind, (g: THREE.Group, p: Parts, d: Dims) => void> = {
  bed(g, p, { w, d, h }) {
    box(g, w, 0.9, d, p.dark, 0, 0.45, 0);
    box(g, w - 0.2, 0.75, d - 0.45, p.light, 0, 0.9 + 0.37, 0.18);
    box(g, w, h, 0.25, p.base, 0, h / 2, -d / 2 + 0.125);
    for (const sx of [-1, 1]) box(g, w / 2 - 0.45, 0.3, 1.0, "#ffffff", sx * (w / 4), 1.8, -d / 2 + 1.05);
    box(g, w - 0.3, 0.12, d * 0.55, p.base, 0, 1.72, d * 0.18);
  },

  sofa(g, p, { w, d, h }) {
    const arm = 0.65;
    box(g, w, 1.0, d, p.dark, 0, 0.5, 0);
    const n = Math.max(2, Math.round(w / 2.4));
    const cw = (w - arm * 2) / n;
    for (let i = 0; i < n; i++) box(g, cw - 0.04, 0.55, d - 0.95, p.base, -w / 2 + arm + cw * (i + 0.5), 1.27, 0.3);
    box(g, w, h - 1.0, 0.8, p.base, 0, 1.0 + (h - 1.0) / 2, -d / 2 + 0.4);
    for (const sx of [-1, 1]) box(g, arm, 1.5, d, p.base, sx * (w / 2 - arm / 2), 1.0 + 0.1, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.18, 0.28, 0.18, "#3a2a1e", sx * (w / 2 - 0.25), 0.1, sz * (d / 2 - 0.25));
  },

  dining(g, p, { w }) {
    const r = Math.max(1.2, w / 2 - 1.05);
    cyl(g, r, r, 0.14, p.light, 0, 2.5, 0);
    cyl(g, 0.16, 0.16, 2.4, p.dark, 0, 1.2, 0);
    cyl(g, 0.7, 0.7, 0.1, p.dark, 0, 0.05, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const chair = new THREE.Group();
      box(chair, 1.3, 0.14, 1.3, p.base, 0, 1.45, 0);
      box(chair, 1.3, 1.3, 0.14, p.base, 0, 2.15, -0.62);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(chair, 0.12, 1.4, 0.12, p.dark, sx * 0.55, 0.7, sz * 0.55);
      const dist = r + 0.65;
      chair.position.set(Math.sin(a) * dist, 0, Math.cos(a) * dist);
      chair.rotation.y = a + Math.PI; // each chair faces the table
      g.add(chair);
    }
  },

  desk(g, p, { w, d, h }) {
    box(g, w, 0.16, d, p.light, 0, h - 0.08, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) if (!(sx === 1)) box(g, 0.16, h - 0.16, 0.16, p.dark, sx * (w / 2 - 0.15), (h - 0.16) / 2, sz * (d / 2 - 0.15));
    box(g, 1.3, h - 0.16, d - 0.15, p.base, w / 2 - 0.72, (h - 0.16) / 2, 0);
    for (const y of [0.55, 1.2, 1.85]) box(g, 1.0, 0.05, 0.03, p.dark, w / 2 - 0.72, y, d / 2 - 0.05);
    box(g, 1.7, 1.0, 0.08, "#141d1b", -0.4, h + 0.75, -d / 2 + 0.5);
    box(g, 1.6, 0.9, 0.02, "#2a8f86", -0.4, h + 0.75, -d / 2 + 0.56, { emissive: new THREE.Color("#1d6f68"), emissiveIntensity: 0.5 });
    box(g, 0.1, 0.35, 0.1, "#141d1b", -0.4, h + 0.18, -d / 2 + 0.5);
  },

  wardrobe(g, p, { w, d, h }) {
    box(g, w, h - 0.2, d, p.base, 0, 0.2 + (h - 0.2) / 2, 0);
    for (const sx of [-1, 1]) {
      box(g, w / 2 - 0.08, h - 0.6, 0.05, p.light, sx * (w / 4), 0.2 + (h - 0.2) / 2, d / 2 + 0.02);
      box(g, 0.06, 0.8, 0.07, p.dark, sx * 0.14, 0.2 + (h - 0.2) / 2, d / 2 + 0.07);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.14, 0.2, 0.14, p.dark, sx * (w / 2 - 0.2), 0.1, sz * (d / 2 - 0.2));
  },

  chair(g, p) {
    box(g, 1.6, 0.2, 1.6, p.base, 0, 1.6, 0.1);
    box(g, 1.5, 1.7, 0.18, p.base, 0, 2.55, -0.7);
    cyl(g, 0.09, 0.09, 1.4, "#33413d", 0, 0.85, 0.1);
    for (let i = 0; i < 3; i++) {
      const spoke = box(g, 1.9, 0.1, 0.16, "#33413d", 0, 0.14, 0.1);
      spoke.rotation.y = (i * Math.PI) / 3;
    }
  },

  shelf(g, p, { w, d, h }) {
    for (const sx of [-1, 1]) box(g, 0.08, h, d, p.dark, sx * (w / 2 - 0.04), h / 2, 0);
    box(g, w, h, 0.04, p.dark, 0, h / 2, -d / 2 + 0.02);
    const levels = 5;
    for (let i = 0; i <= levels; i++) box(g, w - 0.16, 0.08, d, p.light, 0, 0.1 + ((h - 0.2) / levels) * i, 0);
    const colors = ["#e5603a", "#1f6b5b", "#f1b44c", "#46544f", "#b9855a"];
    for (let i = 0; i < levels; i++) {
      const y = 0.18 + ((h - 0.2) / levels) * i;
      if (i % 2 === 0) for (let k = 0; k < 4; k++) box(g, 0.14, 0.7 + (k % 2) * 0.2, 0.6, colors[(i + k) % 5], -w / 2 + 0.3 + k * 0.17, y + 0.4, 0);
      else box(g, 0.4, 0.4, 0.4, p.base, w / 4, y + 0.24, 0);
    }
  },

  fridge(g, p, { w, d, h }) {
    box(g, w, h, d, p.base, 0, h / 2, 0, { roughness: 0.4, metalness: 0.25 });
    box(g, w + 0.01, 0.03, d + 0.01, p.dark, 0, h * 0.68, 0);
    for (const y of [h * 0.84, h * 0.45]) box(g, 0.09, 0.7, 0.1, "#46544f", w / 2 - 0.25, y, d / 2 + 0.06);
    box(g, w - 0.1, 0.12, d - 0.1, p.dark, 0, 0.06, 0);
  },

  washer(g, p, { w, d, h }) {
    box(g, w, h, d, p.base, 0, h / 2, 0, { roughness: 0.4, metalness: 0.2 });
    cyl(g, 0.72, 0.72, 0.12, "#2b3a38", 0, h * 0.45, d / 2 + 0.02, Math.PI / 2);
    cyl(g, 0.55, 0.55, 0.14, "#6fb6c9", 0, h * 0.45, d / 2 + 0.05, Math.PI / 2, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
    box(g, w - 0.25, 0.3, 0.06, "#2b3a38", 0, h - 0.28, d / 2 + 0.03);
    box(g, 0.18, 0.1, 0.07, "#e5603a", w / 2 - 0.4, h - 0.28, d / 2 + 0.07);
  },

  tv(g, p, { w, h }) {
    box(g, 1.5, 0.08, 0.8, "#161f1d", 0, 0.04, 0);
    box(g, 0.16, 0.6, 0.1, "#161f1d", 0, 0.4, 0);
    box(g, w, h - 0.5, 0.1, "#161f1d", 0, 0.5 + (h - 0.5) / 2, 0);
    box(g, w - 0.14, h - 0.64, 0.02, "#2a8f86", 0, 0.5 + (h - 0.5) / 2, 0.06, { emissive: new THREE.Color("#1d6f68"), emissiveIntensity: 0.55, roughness: 0.2 });
  },

  ac(g, p, { w, d, h, lift = 7 }) {
    box(g, w, h, d, "#f2f5f6", 0, lift + h / 2, 0, { roughness: 0.5 });
    box(g, w - 0.3, 0.08, 0.06, "#7d8a88", 0, lift + 0.22, d / 2, {});
    box(g, w - 0.2, 0.28, 0.03, p.base.clone().lerp(new THREE.Color("#ffffff"), 0.2), 0, lift + h * 0.78, d / 2 + 0.01);
    box(g, 0.08, 0.08, 0.04, "#2fd27a", w / 2 - 0.3, lift + h * 0.78, d / 2 + 0.03, { emissive: new THREE.Color("#2fd27a"), emissiveIntensity: 0.9 });
  },

  microwave(g, p, { w, d, h }) {
    box(g, w, 1.7, d, p.light, 0, 0.85, 0);
    box(g, w - 0.1, 0.05, d - 0.1, p.dark, 0, 1.72, 0);
    const mh = h - 1.75;
    box(g, w, mh, d * 0.9, p.base, 0, 1.75 + mh / 2, 0);
    box(g, w * 0.62, mh * 0.78, 0.03, "#141d1b", -w * 0.12, 1.75 + mh / 2, d * 0.45 + 0.02, { roughness: 0.15 });
    cyl(g, 0.14, 0.14, 0.05, p.dark, w * 0.36, 1.75 + mh * 0.68, d * 0.45 + 0.03, Math.PI / 2);
  },

  purifier(g, p, { w, d, h }) {
    box(g, w - 0.1, 1.6, d - 0.1, p.light, 0, 0.8, 0);
    const uh = h - 1.6;
    box(g, w, uh, d, p.base, 0, 1.6 + uh / 2, 0, { roughness: 0.35 });
    box(g, w * 0.6, uh * 0.34, 0.03, "#ffffff", 0, 1.6 + uh * 0.68, d / 2 + 0.02);
    cyl(g, 0.05, 0.05, 0.08, "#1f6b5b", 0, 1.6 + uh * 0.2, d / 2 + 0.03, Math.PI / 2);
  },
};

export function buildModel(art: ArtKind, tint: string, dims: Dims): THREE.Group {
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
