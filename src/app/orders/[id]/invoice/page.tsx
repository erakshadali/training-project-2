import type { Metadata } from "next";
import { OrderInvoice } from "@/components/OrderViews";

export const metadata: Metadata = { title: "Rental invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderInvoice id={id} />;
}
