import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin dashboard", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  // Customers get a plain 404 so the admin area is not advertised.
  if (user.role !== "admin") notFound();
  return <AdminDashboard />;
}
