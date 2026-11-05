import { describe, expect, it } from "vitest";
import { layoutSchema, MAX_ITEMS } from "@/lib/layouts";

const good = {
  name: "Living room",
  items: [{ pid: "p-1", x: 3, z: 2, rot: 0 }],
  quad: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 4 }, { x: 0, y: 4 }],
  W: 12, D: 9, hfov: 65, imgW: 1200, imgH: 800, isSample: false,
  photo: "data:image/jpeg;base64,/9j/4AAQ", thumb: "",
};

describe("layout validation", () => {
  it("accepts a good layout", () => expect(layoutSchema.safeParse(good).success).toBe(true));
  it("accepts the sample hall without a photo", () => expect(layoutSchema.safeParse({ ...good, isSample: true, photo: "" }).success).toBe(true));
  it("needs a photo unless it is the sample", () => expect(layoutSchema.safeParse({ ...good, photo: "" }).success).toBe(false));
  it("rejects a name that is blank or too long", () => {
    expect(layoutSchema.safeParse({ ...good, name: "   " }).success).toBe(false);
    expect(layoutSchema.safeParse({ ...good, name: "x".repeat(41) }).success).toBe(false);
  });
  it("only allows JPEG data URLs for the photo", () => {
    expect(layoutSchema.safeParse({ ...good, photo: "https://evil.example/x.jpg" }).success).toBe(false);
    expect(layoutSchema.safeParse({ ...good, photo: "data:text/html;base64,PHNjcmlwdD4=" }).success).toBe(false);
  });
  it("needs exactly four floor corners and sane numbers", () => {
    expect(layoutSchema.safeParse({ ...good, quad: good.quad.slice(0, 3) }).success).toBe(false);
    expect(layoutSchema.safeParse({ ...good, W: 500 }).success).toBe(false);
    expect(layoutSchema.safeParse({ ...good, items: [{ pid: "p-1", x: NaN, z: 0, rot: 0 }] }).success).toBe(false);
  });
  it("caps the number of pieces", () => {
    const many = Array.from({ length: MAX_ITEMS + 1 }, () => good.items[0]);
    expect(layoutSchema.safeParse({ ...good, items: many }).success).toBe(false);
  });
});
