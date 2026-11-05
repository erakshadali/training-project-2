"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { m } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type Mode = "login" | "register";

/** Only allow redirects to pages on this site. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isRegister = mode === "register";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setErrors({});
    const result = isRegister
      ? await register({ name: form.name, email: form.email, phone: form.phone, password: form.password })
      : await login(form.email, form.password);
    if (result.ok) {
      router.push(next);
      router.refresh();
      return;
    }
    setErrors(result.fields ?? {});
    setMessage(result.error);
    setBusy(false);
  }

  const input = (k: string) =>
    `mt-1.5 w-full rounded-2xl border bg-paper px-4 py-3 outline-none transition focus:border-moss ${errors[k] ? "border-coral" : "border-line"}`;

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-12 sm:px-6">
      <m.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-[2rem] border border-line bg-paper p-7 shadow-[0_24px_60px_-30px_rgba(13,59,51,0.4)]">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-ink-soft">{isRegister ? "Track your rentals, raise repair requests and extend plans." : "Log in to see your rentals and place orders."}</p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          {isRegister && (
            <label className="block text-sm font-semibold">Full name
              <input value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={input("name")} aria-invalid={!!errors.name} />
              {errors.name && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.name}</span>}
            </label>
          )}
          <label className="block text-sm font-semibold">Email
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className={input("email")} aria-invalid={!!errors.email} />
            {errors.email && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.email}</span>}
          </label>
          {isRegister && (
            <label className="block text-sm font-semibold">Mobile number
              <input value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel" className={input("phone")} aria-invalid={!!errors.phone} />
              {errors.phone && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.phone}</span>}
            </label>
          )}
          <label className="block text-sm font-semibold">Password
            <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} className={input("password")} aria-invalid={!!errors.password} />
            {errors.password && <span className="mt-1 block text-xs font-medium text-coral-deep">{errors.password}</span>}
            {isRegister && !errors.password && <span className="mt-1 block text-xs font-normal text-ink-soft">At least 8 characters.</span>}
          </label>

          {message && <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{message}</p>}

          <m.button whileTap={{ scale: 0.97 }} disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3.5 font-semibold text-white transition hover:bg-coral-deep disabled:opacity-70">
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Please wait...</> : isRegister ? "Create account" : "Log in"}
          </m.button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft">
          {isRegister ? "Already have an account? " : "New to RentEase? "}
          <Link href={`${isRegister ? "/login" : "/register"}?next=${encodeURIComponent(next)}`} className="font-semibold text-moss hover:underline">
            {isRegister ? "Log in" : "Create one"}
          </Link>
        </p>
      </m.div>
    </div>
  );
}
