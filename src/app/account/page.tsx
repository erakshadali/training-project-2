import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = { title: "My rentals" };

export default function AccountPage() {
  return <Dashboard />;
}
