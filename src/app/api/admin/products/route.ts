import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin, zodFields } from "@/lib/adminGuard";
import { toProduct } from "@/lib/catalog";
import { ProductModel } from "@/models";

const arts = ["bed", "sofa", "dining", "desk", "wardrobe", "chair", "shelf", "fridge", "washer", "tv", "ac", "microwave", "purifier"] as const;

const createSchema = z.object({
  name: z.string().trim().min(3).max(80),
  category: z.enum(["furniture", "appliances"]),
  subcategory: z.string().trim().min(2).max(40),
  art: z.enum(arts),
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #2f6f62"),
  blurb: z.string().trim().min(10).max(160),
  description: z.string().trim().min(20).max(600),
  rent: z.number().int().min(50).max(50_000),
  deposit: z.number().int().min(0).max(200_000),
  stock: z.number().int().min(0).max(10_000),
  popular: z.boolean().default(false),
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** All products, including hidden ones, with how many units are currently out on rent. */
export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const docs = await ProductModel.find({}).sort({ createdAt: 1, _id: 1 }).lean();
  return json({ products: docs.map((d) => ({ ...toProduct(d as never), active: d.active !== false })) });
}

export async function POST(req: Request) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Please fix the highlighted fields.", 400, zodFields(parsed.error.issues));
  const d = parsed.data;

  let slug = slugify(d.name);
  if (!slug) return fail("Use letters or numbers in the name.", 400, { name: "Use letters or numbers" });
  if (await ProductModel.exists({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const created = await ProductModel.create({
    pid: `p-${slug}`.slice(0, 70),
    slug,
    name: d.name,
    category: d.category,
    subcategory: d.subcategory,
    art: d.art,
    tint: d.tint,
    blurb: d.blurb,
    description: d.description,
    rent: d.rent,
    deposit: d.deposit,
    features: ["Free delivery and installation", "Free repairs during the rental"],
    specs: {},
    popular: d.popular,
    stock: d.stock,
  });
  return json({ product: toProduct(created.toObject() as never) }, 201);
}
