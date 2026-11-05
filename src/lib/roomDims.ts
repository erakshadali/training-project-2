import type { ArtKind, Product } from "@/data/products";
import { decorDims } from "@/lib/roomDecor";

/** Real-world size in feet. width = left/right, depth = front/back, height = up. */
export type Dims = {
  w: number;
  d: number;
  h: number;
  /** height above the floor, for wall-mounted items */
  lift?: number;
  /** lies on the floor, like a rug, so furniture can stand on it */
  flat?: boolean;
};

/** Default size for each kind of product, used when a product has no specific entry. */
const byKind: Record<ArtKind, Dims> = {
  bed: { w: 5, d: 6.5, h: 3.2 },
  sofa: { w: 6, d: 3, h: 2.8 },
  dining: { w: 4.8, d: 4.8, h: 3 },
  desk: { w: 4, d: 2, h: 2.5 },
  wardrobe: { w: 3, d: 1.8, h: 6 },
  chair: { w: 2, d: 2, h: 3.5 },
  shelf: { w: 2.5, d: 1, h: 5.8 },
  fridge: { w: 2, d: 2.1, h: 5 },
  washer: { w: 2, d: 2.2, h: 3 },
  tv: { w: 3.2, d: 1, h: 2.3 },
  ac: { w: 3, d: 0.9, h: 1, lift: 7 },
  microwave: { w: 1.7, d: 1.4, h: 2.8 },
  purifier: { w: 1.1, d: 1.1, h: 3 },
};

/** Measured sizes for the seeded catalog (feet). */
const byProduct: Record<string, Dims> = {
  "p-bed-queen": { w: 5, d: 6.5, h: 3.3 },
  "p-bed-single": { w: 3, d: 6.2, h: 2.8 },
  "p-sofa-3": { w: 7, d: 3, h: 2.8 },
  "p-sofa-2": { w: 4.8, d: 3, h: 2.8 },
  "p-dining-4": { w: 4.8, d: 4.8, h: 3 },
  "p-desk": { w: 4, d: 2, h: 2.5 },
  "p-wardrobe": { w: 3, d: 1.8, h: 6 },
  "p-chair": { w: 2, d: 2, h: 3.5 },
  "p-shelf": { w: 2.5, d: 1, h: 5.8 },
  "p-fridge-single": { w: 1.9, d: 2.1, h: 4.8 },
  "p-fridge-double": { w: 2.4, d: 2.3, h: 5.6 },
  "p-washer-front": { w: 2, d: 2.2, h: 2.9 },
  "p-washer-top": { w: 2, d: 2, h: 3.2 },
  "p-tv-43": { w: 3.2, d: 1, h: 2.3 },
  "p-ac": { w: 3, d: 0.9, h: 1, lift: 7 },
  "p-microwave": { w: 1.7, d: 1.4, h: 2.8 },
  "p-purifier": { w: 1.1, d: 1.1, h: 3 },
};

export function dimsFor(product: Pick<Product, "id" | "art">): Dims {
  return byProduct[product.id] ?? decorDims(product.id) ?? byKind[product.art];
}

/** Items that sit on a stand or are mounted high are not meant to be judged by floor clearance alone. */
export function isWallMounted(d: Dims) {
  return (d.lift ?? 0) > 0;
}

/** Pieces that use no floor space for crowding and overlap checks: wall-mounted pieces and flat rugs. */
export function takesNoFloor(d: Dims) {
  return isWallMounted(d) || !!d.flat;
}
