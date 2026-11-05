"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { cities, type City } from "@/data/config";
import { useAuth } from "@/context/AuthContext";
import { useCatalog } from "@/context/CatalogContext";
import { addDays, inr, monthlyRent, toISODate } from "@/lib/pricing";
import type { Order } from "@/lib/orders";

const slots = ["9 AM to 12 PM", "12 PM to 3 PM", "3 PM to 6 PM"];
const payments = [
  { id: "cod", label: "Pay at delivery", hint: "Cash or UPI to the delivery team (demo, nothing is charged)" },
  { id: "upi", label: "UPI link", hint: "We send a payment link after confirming your order (demo)" },
];

type Errors = Partial<Record<"name" | "phone" | "email" | "address" | "pincode" | "deliveryDate", string>>;

export function CheckoutView() {
  const router = useRouter();
  const { lines, rentPerMonth, deposit, city, setCity, clear, ready } = useCart();
  const { user } = useAuth();
  const { getProductById } = useCatalog();
  // Dates depend on "today", so they are computed after mount to keep the page prerenderable.
  const [{ minDate, maxDate }, setRange] = useState({ minDate: "", maxDate: "" });
  useEffect(() => {
    const today = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- needs the browser's current date
    setRange({ minDate: toISODate(addDays(today, 2)), maxDate: toISODate(addDays(today, 45)) });
  }, []);

  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    address: "",
    pincode: "",
    deliveryDate: "",
    slot: slots[0],
    payment: "cod",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (!ready) return <div className="mx-auto max-w-5xl px-4 py-20 text-ink-soft sm:px-6">Loading...</div>;
  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-semibold">Nothing to check out yet</h1>
        <Link href="/products" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 font-semibold text-white hover:bg-coral">Browse products</Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-semibold">Log in to place your order</h1>
        <p className="mt-2 text-ink-soft">Your cart is saved. Log in or create an account and you will come straight back here.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login?next=/checkout" className="rounded-full bg-forest px-6 py-3 font-semibold text-white hover:bg-coral">Log in</Link>
          <Link href="/register?next=/checkout" className="rounded-full border border-forest px-6 py-3 font-semibold text-forest hover:bg-forest hover:text-white">Create account</Link>
        </div>
      </div>
    );
  }

  function validate(): Errors {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = "Enter your full name";
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) e.phone = "Enter a 10 digit Indian mobile number";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email";
    if (form.address.trim().length < 10) e.address = "Add your flat, building and area";
    if (!/^\d{6}$/.test(form.pincode.trim())) e.pincode = "Enter a 6 digit pincode";
    if (!form.deliveryDate || form.deliveryDate < minDate || form.deliveryDate > maxDate) e.deliveryDate = "Pick a date in the next 45 days, at least 2 days away";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`field-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          city,
          pincode: form.pincode.trim(),
          deliveryDate: form.deliveryDate,
          slot: form.slot,
          payment: form.payment,
          lines: lines.map((l) => ({ productId: l.productId, months: l.months, qty: l.qty })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { order?: Order; error?: string; fields?: Errors };
      if (res.status === 401) {
        router.push("/login?next=/checkout");
        return;
      }
      if (!res.ok || !data.order) {
        if (data.fields) setErrors(data.fields);
        setServerError(data.error ?? "We could not place your order. Please try again.");
        setSubmitting(false);
        return;
      }
      clear();
      router.push(`/orders/${data.order.id}`);
    } catch {
      setServerError("Network problem. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  const field = "mt-1.5 w-full rounded-2xl border bg-paper px-4 py-3 outline-none transition focus:border-moss";
  const err = (k: keyof Errors) => (errors[k] ? "border-coral" : "border-line");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Checkout</h1>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-line bg-paper p-6">
            <h2 className="font-display text-xl font-semibold">Your details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Full name
                <input id="field-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={`${field} ${err("name")}`} aria-invalid={!!errors.name} />
                {errors.name && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.name}</span>}
              </label>
              <label className="block text-sm font-semibold">Mobile number
                <input id="field-phone" value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel" className={`${field} ${err("phone")}`} aria-invalid={!!errors.phone} />
                {errors.phone && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.phone}</span>}
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">Email
                <input id="field-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className={`${field} ${err("email")}`} aria-invalid={!!errors.email} />
                {errors.email && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.email}</span>}
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-paper p-6">
            <h2 className="font-display text-xl font-semibold">Delivery address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold sm:col-span-2">Flat, building and area
                <textarea id="field-address" rows={3} value={form.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" className={`${field} ${err("address")}`} aria-invalid={!!errors.address} />
                {errors.address && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.address}</span>}
              </label>
              <label className="block text-sm font-semibold">City
                <select value={city} onChange={(e) => setCity(e.target.value as City)} className={`${field} border-line`}>
                  {cities.map((c) => (<option key={c}>{c}</option>))}
                </select>
              </label>
              <label className="block text-sm font-semibold">Pincode
                <input id="field-pincode" value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="postal-code" className={`${field} ${err("pincode")}`} aria-invalid={!!errors.pincode} />
                {errors.pincode && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.pincode}</span>}
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-paper p-6">
            <h2 className="font-display text-xl font-semibold">Delivery date and time</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Date
                <input id="field-deliveryDate" type="date" min={minDate} max={maxDate} value={form.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} className={`${field} ${err("deliveryDate")}`} aria-invalid={!!errors.deliveryDate} />
                {errors.deliveryDate && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.deliveryDate}</span>}
              </label>
              <fieldset>
                <legend className="text-sm font-semibold">Time slot</legend>
                <div className="mt-1.5 grid gap-2">
                  {slots.map((s) => (
                    <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-medium transition ${form.slot === s ? "border-forest bg-mint/50" : "border-line hover:border-moss"}`}>
                      <input type="radio" name="slot" checked={form.slot === s} onChange={() => set("slot", s)} className="accent-[#0d3b33]" /> {s}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-paper p-6">
            <h2 className="font-display text-xl font-semibold">Payment</h2>
            <div className="mt-4 grid gap-3">
              {payments.map((p) => (
                <label key={p.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${form.payment === p.id ? "border-forest bg-mint/50" : "border-line hover:border-moss"}`}>
                  <input type="radio" name="payment" checked={form.payment === p.id} onChange={() => set("payment", p.id)} className="mt-1 accent-[#0d3b33]" />
                  <span><span className="block font-semibold">{p.label}</span><span className="text-sm text-ink-soft">{p.hint}</span></span>
                </label>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft"><Lock className="h-3.5 w-3.5" /> This is a demo. We never ask for card or bank details.</p>
          </section>
        </div>

        <aside className="h-fit rounded-3xl border border-line bg-paper p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-semibold">Summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {lines.map((l) => {
              const p = getProductById(l.productId);
              if (!p) return null;
              return (
                <li key={l.productId} className="flex justify-between gap-3">
                  <span className="text-ink-soft">{l.qty} x {p.name} <span className="text-xs">({l.months} mo)</span></span>
                  <span className="font-semibold">{inr(monthlyRent(p, l.months) * l.qty)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Monthly rent</dt><dd className="font-bold">{inr(rentPerMonth)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Refundable deposit</dt><dd className="font-semibold">{inr(deposit)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Delivery and installation</dt><dd className="font-semibold text-moss">Free</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base"><dt className="font-semibold">Due at delivery</dt><dd className="font-bold text-forest">{inr(rentPerMonth + deposit)}</dd></div>
          </dl>
          {serverError && (
            <p role="alert" className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{serverError}</p>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={submitting}
            type="submit"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3.5 font-semibold text-white transition hover:bg-coral-deep disabled:opacity-70"
          >
            {submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Placing order...</> : "Place order"}
          </motion.button>
        </aside>
      </form>
    </div>
  );
}
