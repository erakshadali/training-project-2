import { connectDb } from "@/lib/db";
import { ProductModel, ServiceAreaModel } from "@/models";
import type { ArtKind, Category, Product } from "@/data/products";

type Lean = {
  pid: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string;
  art: string;
  tint: string;
  blurb: string;
  description: string;
  rent: number;
  deposit: number;
  features: string[];
  specs?: unknown;
  popular?: boolean;
  stock: number;
};

export function toProduct(d: Lean): Product {
  return {
    id: d.pid,
    slug: d.slug,
    name: d.name,
    category: d.category as Category,
    subcategory: d.subcategory,
    art: d.art as ArtKind,
    tint: d.tint,
    blurb: d.blurb,
    description: d.description,
    rent: d.rent,
    deposit: d.deposit,
    features: d.features ?? [],
    specs: (d.specs as Record<string, string>) ?? {},
    popular: !!d.popular,
    stock: d.stock,
  };
}

export async function getAllProducts(): Promise<Product[]> {
  await connectDb();
  const docs = await ProductModel.find({ active: { $ne: false } }).sort({ createdAt: 1, _id: 1 }).lean();
  return docs.map((d) => toProduct(d as unknown as Lean));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await connectDb();
  const d = await ProductModel.findOne({ slug, active: { $ne: false } }).lean();
  return d ? toProduct(d as unknown as Lean) : null;
}

/** Names of the cities we currently deliver to. */
export async function getActiveAreas(): Promise<string[]> {
  await connectDb();
  const docs = await ServiceAreaModel.find({ active: true }).sort({ name: 1 }).lean();
  return docs.map((d) => d.name);
}
