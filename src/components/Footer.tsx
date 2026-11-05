import Link from "next/link";
import { Logo } from "@/components/Header";
import { getActiveAreas } from "@/lib/catalog";

export async function Footer() {
  const cities = await getActiveAreas();
  return (
    <footer className="mt-24 bg-forest-deep text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
            Furniture and appliances on flexible monthly plans. Free delivery, free installation, free maintenance and a fully
            refundable deposit.
          </p>
          <p className="mt-6 text-xs text-white/60">
            RentEase is a student project built for the Unified Mentor full stack internship. Products, prices and orders are
            demo data and no real payments are taken.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Shop</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/products?category=furniture">Furniture</Link></li>
            <li><Link className="hover:text-white" href="/products?category=appliances">Appliances</Link></li>
            <li><Link className="hover:text-white" href="/products">All products</Link></li>
            <li><Link className="hover:text-white" href="/cart">Cart</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">We deliver in</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {cities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/60">
        &copy; 2026 RentEase. Built with Next.js, TypeScript and Tailwind CSS.
      </div>
    </footer>
  );
}
