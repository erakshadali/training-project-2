import type { ArtKind, Product } from "@/data/products";
import type { Dims } from "@/lib/roomDims";

/**
 * Decor for Room Studio: a rug, a plant, a mirror, a coffee table and a floor lamp.
 * These are free to place and are not rental products. They are never added to the cart, never priced,
 * and never counted in the rent total. They make a room look lived in, like the photos on rental sites.
 */

export type DecorKind = "rug" | "plant" | "mirror" | "coffee" | "lamp";

export type DecorItem = { id: string; name: string; kind: DecorKind; tint: string; blurb: string; dims: Dims };

export const DECOR: DecorItem[] = [
  { id: "d-rug-grey", name: "Grey wool rug", kind: "rug", tint: "#9a9690", blurb: "Soft grey rug that ties the seating together", dims: { w: 7, d: 5, h: 0.05, flat: true } },
  { id: "d-rug-terra", name: "Terracotta rug", kind: "rug", tint: "#b4573a", blurb: "A warm colour pop under the coffee table", dims: { w: 6, d: 4, h: 0.05, flat: true } },
  { id: "d-plant", name: "Indoor plant", kind: "plant", tint: "#2f7d4f", blurb: "A leafy plant in a clay pot", dims: { w: 1.4, d: 1.4, h: 3.8 } },
  { id: "d-mirror", name: "Octagon wall mirror", kind: "mirror", tint: "#c9a257", blurb: "Brass frame mirror that bounces light around", dims: { w: 2.2, d: 0.15, h: 2.2, lift: 3.4 } },
  { id: "d-coffee", name: "Wooden coffee table", kind: "coffee", tint: "#b07a3f", blurb: "A low table for books and a cup of tea", dims: { w: 3.2, d: 1.9, h: 1.4 } },
  { id: "d-lamp", name: "Floor lamp", kind: "lamp", tint: "#e8c98a", blurb: "Warm light for the evening", dims: { w: 1.2, d: 1.2, h: 5.4 } },
];

export const isDecorId = (id: string) => id.startsWith("d-");

const byId = new Map(DECOR.map((d) => [d.id, d]));
export const decorDims = (id: string): Dims | undefined => byId.get(id)?.dims;

/**
 * Decor shaped like a Product, so the 3D scene, the arrange box and the saved layouts can treat it like any
 * other piece. Price, deposit and stock are zero, and every place that adds up money skips decor ids.
 */
export const decorProducts: Product[] = DECOR.map((d) => ({
  id: d.id,
  slug: d.id,
  name: d.name,
  category: "furniture",
  subcategory: "Decor",
  art: d.kind as unknown as ArtKind,
  tint: d.tint,
  blurb: d.blurb,
  description: d.blurb,
  rent: 0,
  deposit: 0,
  features: [],
  specs: {},
  stock: 0,
}));
