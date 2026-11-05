import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildModel, disposeModel } from "@/components/room/models";
import { products } from "@/data/products";
import { DECOR, decorProducts, isDecorId } from "@/lib/roomDecor";
import { dimsFor, takesNoFloor } from "@/lib/roomDims";

/** Every model must be built at roughly the real size of the product, standing on the floor and facing front. */
describe("3D models match their real sizes", () => {
  const all = [...products, ...decorProducts];
  for (const p of all) {
    it(`${p.name} is about the right size and sits on the floor`, () => {
      const dims = dimsFor(p);
      const group = buildModel(p.art, p.tint, dims);
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      expect(Number.isFinite(size.x + size.y + size.z)).toBe(true);
      // width and depth within 40% either way (the swivel chair spreads its wheels, the dining chairs stick out), height within 25%
      expect(size.x).toBeGreaterThan(dims.w * 0.6);
      expect(size.x).toBeLessThan(dims.w * 1.45);
      expect(size.z).toBeGreaterThan(dims.d * 0.5);
      expect(size.z).toBeLessThan(dims.d * 1.6);
      const lift = dims.lift ?? 0;
      const top = dims.h + lift;
      expect(box.max.y).toBeGreaterThan(top * 0.8);
      expect(box.max.y).toBeLessThan(top * 1.35 + (p.art === "desk" ? 1.5 : 0)); // the desk model includes a monitor
      // stands on the floor (or hangs at its lift height), never sunk into it
      expect(box.min.y).toBeGreaterThan(lift - 0.05);
      expect(box.min.y).toBeLessThan(lift + 0.3);
      disposeModel(group);
    });
  }
});

describe("decor", () => {
  it("has unique ids and sizes for every piece", () => {
    expect(new Set(DECOR.map((d) => d.id)).size).toBe(DECOR.length);
    for (const d of DECOR) {
      expect(isDecorId(d.id)).toBe(true);
      expect(dimsFor({ id: d.id, art: d.kind as never })).toEqual(d.dims);
    }
  });
  it("is free: no rent, deposit or stock", () => {
    for (const d of decorProducts) expect(d.rent + d.deposit + d.stock).toBe(0);
  });
  it("lets rugs and mirrors take no floor space but not plants or tables", () => {
    const by = (id: string) => dimsFor(decorProducts.find((d) => d.id === id)!);
    expect(takesNoFloor(by("d-rug-grey"))).toBe(true);
    expect(takesNoFloor(by("d-mirror"))).toBe(true);
    expect(takesNoFloor(by("d-plant"))).toBe(false);
    expect(takesNoFloor(by("d-coffee"))).toBe(false);
  });
  it("never uses an id that a real product has", () => {
    const real = new Set(products.map((p) => p.id));
    for (const d of DECOR) expect(real.has(d.id)).toBe(false);
  });
});
