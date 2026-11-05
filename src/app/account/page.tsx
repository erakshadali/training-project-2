import type { Metadata } from "next";
import { AccountView } from "@/components/OrderViews";

export const metadata: Metadata = { title: "My rentals" };

export default function AccountPage() {
  return <AccountView />;
}
