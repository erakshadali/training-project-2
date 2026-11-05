import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/OrderViews";

export const metadata: Metadata = { title: "Your order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderConfirmation id={id} />;
}
