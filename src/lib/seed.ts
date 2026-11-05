import bcrypt from "bcryptjs";
import { products as seedProducts } from "@/data/products";
import { ProductModel, UserModel } from "@/models";

/** Fills an empty database with the catalog and, when configured, an admin account. */
export async function seedIfEmpty() {
  if ((await ProductModel.estimatedDocumentCount()) === 0) {
    await ProductModel.insertMany(
      seedProducts.map((p) => ({
        pid: p.id,
        slug: p.slug,
        name: p.name,
        category: p.category,
        subcategory: p.subcategory,
        art: p.art,
        tint: p.tint,
        blurb: p.blurb,
        description: p.description,
        rent: p.rent,
        deposit: p.deposit,
        features: p.features,
        specs: p.specs,
        popular: !!p.popular,
        stock: p.stock,
      })),
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && !(await UserModel.exists({ email: adminEmail }))) {
    await UserModel.create({
      name: "RentEase Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "admin",
    });
  }
}
