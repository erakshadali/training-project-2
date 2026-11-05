import { z } from "zod";
import type { RoomLayoutDoc } from "@/models";

/** Saved Room Studio layouts. Pure helpers shared by the API routes and tests. */

export const MAX_LAYOUTS = 5;
export const MAX_ITEMS = 30;
/** The compressed photo is about 150 to 300 KB as a data URL. This leaves room but stops abuse. */
export const MAX_PHOTO_CHARS = 700_000;
export const MAX_THUMB_CHARS = 40_000;

const jpeg = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const num = (min: number, max: number) => z.number().finite().min(min).max(max);

export const layoutSchema = z
  .object({
    name: z.string().trim().min(1, "Give the layout a name").max(40, "Keep the name under 40 characters"),
    items: z.array(z.object({ pid: z.string().min(1).max(40), x: num(-5, 100), z: num(-5, 100), rot: num(-100, 100) })).max(MAX_ITEMS, `A layout can hold up to ${MAX_ITEMS} pieces`),
    quad: z.array(z.object({ x: num(0, 6000), y: num(0, 6000) })).length(4, "The floor needs four corners"),
    W: num(4, 60),
    D: num(4, 60),
    hfov: num(30, 120),
    imgW: z.number().int().min(100).max(4000),
    imgH: z.number().int().min(100).max(4000),
    isSample: z.boolean(),
    photo: z.string().max(MAX_PHOTO_CHARS, "That photo is too large to save").refine((v) => v === "" || jpeg.test(v), "The photo must be a JPEG"),
    thumb: z.string().max(MAX_THUMB_CHARS).refine((v) => v === "" || jpeg.test(v), "The preview must be a JPEG"),
  })
  .refine((v) => v.isSample || v.photo !== "", { message: "The photo is missing", path: ["photo"] });

export type LayoutInput = z.infer<typeof layoutSchema>;

type Lean = RoomLayoutDoc & { _id: unknown };

export function summary(d: Lean) {
  return {
    id: String(d._id),
    name: d.name,
    itemCount: d.items.length,
    W: d.W,
    D: d.D,
    thumb: d.thumb,
    isSample: d.isSample,
    updatedAt: (d.updatedAt ?? d.createdAt ?? new Date()).toISOString(),
  };
}

export function full(d: Lean) {
  return {
    ...summary(d),
    items: d.items.map((i) => ({ pid: i.pid, x: i.x, z: i.z, rot: i.rot })),
    quad: d.quad.map((q) => ({ x: q.x, y: q.y })),
    hfov: d.hfov,
    imgW: d.imgW,
    imgH: d.imgH,
    photo: d.photo,
  };
}
