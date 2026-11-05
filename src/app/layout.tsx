import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CatalogProvider } from "@/context/CatalogContext";
import { CartProvider } from "@/context/CartContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { getSessionUser } from "@/lib/auth";
import { getAllProducts } from "@/lib/catalog";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RentEase | Rent furniture & appliances by the month",
    template: "%s | RentEase",
  },
  description:
    "Rent beds, sofas, fridges, washing machines and more on flexible monthly plans. Free delivery, free maintenance, fully refundable deposit.",
};

export const viewport: Viewport = {
  themeColor: "#0d3b33",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [products, user] = await Promise.all([getAllProducts(), getSessionUser()]);
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-screen flex flex-col">
        <AuthProvider initialUser={user}>
          <CatalogProvider products={products}>
            <CartProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
              <CartDrawer />
            </CartProvider>
          </CatalogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
