"use client";

import { useMemo, useState } from "react";
import { Ban, Loader2, Pencil, Plus, Search, ShieldCheck } from "lucide-react";
import type { Ctx } from "@/components/admin/AdminDashboard";
import { Modal } from "@/components/Modal";
import { ProductArt } from "@/components/ProductArt";
import type { ArtKind } from "@/data/products";
import { adminApi, type AdminClaim, type AdminProduct, type AdminRequest } from "@/lib/adminTypes";
import { inr } from "@/lib/pricing";

const fieldCls = "mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 font-normal outline-none focus:border-moss";
const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

function Err({ m }: { m: string }) {
  return m ? <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{m}</p> : null;
}

function Fe({ m }: { m?: string }) {
  return m ? <span className="text-xs text-coral-deep">{m}</span> : null;
}

function Save({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3.5 font-semibold text-white transition hover:bg-coral-deep disabled:opacity-70">
      {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : children}
    </button>
  );
}

/* ------------------------------ Inventory ------------------------------ */

const arts: ArtKind[] = ["bed", "sofa", "dining", "desk", "wardrobe", "chair", "shelf", "fridge", "washer", "tv", "ac", "microwave", "purifier"];

type SortKey = "added" | "name" | "rentLow" | "rentHigh" | "stockLow" | "stockHigh" | "mostOut";
const sortLabels: Record<SortKey, string> = {
  added: "Order added",
  name: "Name, A to Z",
  rentLow: "Rent, low to high",
  rentHigh: "Rent, high to low",
  stockLow: "Stock, lowest first",
  stockHigh: "Stock, highest first",
  mostOut: "Most out on rent",
};

export function Inventory({ data, reload, notify }: Ctx) {
  const [edit, setEdit] = useState<AdminProduct | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | "furniture" | "appliances">("all");
  const [show, setShow] = useState<"all" | "visible" | "hidden" | "low">("all");
  const [sort, setSort] = useState<SortKey>("added");
  const out = new Map(data.stats.byProduct.map((p) => [p.pid, p]));

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const unitsOut = (id: string) => data.stats.byProduct.find((p) => p.pid === id)?.unitsOut ?? 0;
    const list = data.products.filter((p) =>
      (category === "all" || p.category === category) &&
      (show === "all" || (show === "visible" && p.active) || (show === "hidden" && !p.active) || (show === "low" && p.stock <= 3)) &&
      (!term || `${p.name} ${p.subcategory}`.toLowerCase().includes(term)),
    );
    const by: Record<SortKey, (a: AdminProduct, b: AdminProduct) => number> = {
      added: () => 0,
      name: (a, b) => a.name.localeCompare(b.name),
      rentLow: (a, b) => a.rent - b.rent,
      rentHigh: (a, b) => b.rent - a.rent,
      stockLow: (a, b) => a.stock - b.stock,
      stockHigh: (a, b) => b.stock - a.stock,
      mostOut: (a, b) => unitsOut(b.id) - unitsOut(a.id),
    };
    return [...list].sort(by[sort]);
  }, [data.products, data.stats.byProduct, q, category, show, sort]);

  async function toggle(p: AdminProduct) {
    const { ok, data: d } = await adminApi(`/api/admin/products/${p.id}`, "PATCH", { active: !p.active });
    notify(ok ? `${p.name} is now ${p.active ? "hidden from" : "visible in"} the shop.` : String(d.error ?? "Could not update."));
    if (ok) await reload();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Price changes apply to new orders only. Running rentals keep the rent they started with.</p>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-coral"><Plus className="h-4 w-4" /> Add product</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full rounded-full border border-line bg-paper py-2.5 pl-10 pr-4 text-sm outline-none focus:border-moss" />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Category" className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-semibold">
          <option value="all">All categories</option>
          <option value="furniture">Furniture</option>
          <option value="appliances">Appliances</option>
        </select>
        <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Show" className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-semibold">
          <option value="all">All products</option>
          <option value="visible">Visible in shop</option>
          <option value="hidden">Hidden</option>
          <option value="low">Low stock (3 or fewer)</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort products" className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-semibold">
          {(Object.keys(sortLabels) as SortKey[]).map((k) => <option key={k} value={k}>Sort: {sortLabels[k]}</option>)}
        </select>
        <span className="text-xs text-ink-soft">{rows.length} of {data.products.length} products</span>
      </div>
      <div className="mt-3 overflow-x-auto rounded-3xl border border-line bg-paper">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-sand/60 text-xs uppercase tracking-wide text-ink-soft">
            <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Rent / mo</th><th className="px-4 py-3">Deposit</th><th className="px-4 py-3">On shelf</th><th className="px-4 py-3">Out on rent</th><th className="px-4 py-3">Shop</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-soft">No products match these filters.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className={p.active ? "" : "opacity-55"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sand"><ProductArt kind={p.art} tint={p.tint} className="h-10 w-10" /></div>
                    <div><p className="font-semibold">{p.name}</p><p className="text-xs text-ink-soft">{p.subcategory}</p></div>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold">{inr(p.rent)}</td>
                <td className="px-4 py-3">{inr(p.deposit)}</td>
                <td className="px-4 py-3"><span className={p.stock <= 3 ? "font-bold text-coral-deep" : ""}>{p.stock}</span>{p.stock <= 3 && <span className="ml-1 text-xs text-coral-deep">low</span>}</td>
                <td className="px-4 py-3">{out.get(p.id)?.unitsOut ?? 0}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(p)} className={`rounded-full px-3 py-1 text-xs font-bold ${p.active ? "bg-mint text-forest" : "bg-sand text-ink-soft"}`} aria-label={`${p.active ? "Hide" : "Show"} ${p.name}`}>{p.active ? "Visible" : "Hidden"}</button>
                </td>
                <td className="px-4 py-3 text-right"><button onClick={() => setEdit(p)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:border-moss"><Pencil className="h-3.5 w-3.5" /> Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit product">
        {edit && <EditProduct product={edit} onDone={async (m) => { setEdit(null); notify(m); await reload(); }} />}
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a product">
        {adding && <NewProduct onDone={async (m) => { setAdding(false); notify(m); await reload(); }} />}
      </Modal>
    </div>
  );
}

function EditProduct({ product, onDone }: { product: AdminProduct; onDone: (m: string) => void }) {
  const [f, setF] = useState({ name: product.name, blurb: product.blurb, description: product.description, rent: String(product.rent), deposit: String(product.deposit), stock: String(product.stock), popular: !!product.popular });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { ok, data: d } = await adminApi(`/api/admin/products/${product.id}`, "PATCH", {
      name: f.name, blurb: f.blurb, description: f.description, rent: Number(f.rent), deposit: Number(f.deposit), stock: Number(f.stock), popular: f.popular,
    });
    if (ok) return onDone(`${f.name} updated.`);
    setErrors((d.fields as Record<string, string>) ?? {});
    setMsg(String(d.error ?? "Could not save."));
    setBusy(false);
  }
  const num = (k: "rent" | "deposit" | "stock") => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value.replace(/\D/g, "") });

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={fieldCls} />{errors.name && <span className="text-xs text-coral-deep">{errors.name}</span>}</label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm font-semibold">Rent / mo<input inputMode="numeric" value={f.rent} onChange={num("rent")} className={fieldCls} />{errors.rent && <span className="text-xs text-coral-deep">{errors.rent}</span>}</label>
        <label className="block text-sm font-semibold">Deposit<input inputMode="numeric" value={f.deposit} onChange={num("deposit")} className={fieldCls} /></label>
        <label className="block text-sm font-semibold">Stock<input inputMode="numeric" value={f.stock} onChange={num("stock")} className={fieldCls} /></label>
      </div>
      <p className="text-xs text-ink-soft">Rent is the 3 month price. 6 and 12 month plans take 10% and 20% off it.</p>
      <label className="block text-sm font-semibold">Short line<input value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} className={fieldCls} />{errors.blurb && <span className="text-xs text-coral-deep">{errors.blurb}</span>}</label>
      <label className="block text-sm font-semibold">Description<textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={fieldCls} />{errors.description && <span className="text-xs text-coral-deep">{errors.description}</span>}</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f.popular} onChange={(e) => setF({ ...f, popular: e.target.checked })} className="h-4 w-4 accent-[#0d3b33]" /> Show as popular</label>
      <Err m={msg} />
      <Save busy={busy}>Save changes</Save>
    </form>
  );
}

function NewProduct({ onDone }: { onDone: (m: string) => void }) {
  const [f, setF] = useState({ name: "", category: "furniture", subcategory: "", art: "chair" as ArtKind, tint: "#2f6f62", blurb: "", description: "", rent: "", deposit: "", stock: "5", popular: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { ok, data: d } = await adminApi("/api/admin/products", "POST", { ...f, rent: Number(f.rent), deposit: Number(f.deposit), stock: Number(f.stock) });
    if (ok) return onDone(`${f.name} added to the shop.`);
    setErrors((d.fields as Record<string, string>) ?? {});
    setMsg(String(d.error ?? "Could not add the product."));
    setBusy(false);
  }
  const num = (k: "rent" | "deposit" | "stock") => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value.replace(/\D/g, "") });

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-sand p-3">
        <div className="grid h-16 w-16 place-items-center rounded-xl bg-paper"><ProductArt kind={f.art} tint={f.tint} className="h-14 w-14" /></div>
        <p className="text-xs text-ink-soft">Products use the built-in illustrations. Pick the closest one and a colour.</p>
      </div>
      <label className="block text-sm font-semibold">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={fieldCls} /><Fe m={errors.name} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold">Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={fieldCls}><option value="furniture">Furniture</option><option value="appliances">Appliances</option></select></label>
        <label className="block text-sm font-semibold">Type<input value={f.subcategory} onChange={(e) => setF({ ...f, subcategory: e.target.value })} placeholder="Chairs, Beds..." className={fieldCls} /><Fe m={errors.subcategory} /></label>
        <label className="block text-sm font-semibold">Illustration<select value={f.art} onChange={(e) => setF({ ...f, art: e.target.value as ArtKind })} className={fieldCls}>{arts.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label className="block text-sm font-semibold">Colour<input type="color" value={f.tint} onChange={(e) => setF({ ...f, tint: e.target.value })} className="mt-1.5 h-[3.2rem] w-full cursor-pointer rounded-2xl border border-line bg-paper p-1.5" /></label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm font-semibold">Rent / mo<input inputMode="numeric" value={f.rent} onChange={num("rent")} className={fieldCls} /><Fe m={errors.rent} /></label>
        <label className="block text-sm font-semibold">Deposit<input inputMode="numeric" value={f.deposit} onChange={num("deposit")} className={fieldCls} /><Fe m={errors.deposit} /></label>
        <label className="block text-sm font-semibold">Stock<input inputMode="numeric" value={f.stock} onChange={num("stock")} className={fieldCls} /><Fe m={errors.stock} /></label>
      </div>
      <label className="block text-sm font-semibold">Short line<input value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} className={fieldCls} /><Fe m={errors.blurb} /></label>
      <label className="block text-sm font-semibold">Description<textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={fieldCls} /><Fe m={errors.description} /></label>
      <Err m={msg} />
      <Save busy={busy}>Add product</Save>
    </form>
  );
}

/* ------------------------------- Repairs ------------------------------- */

const requestStyle = { Open: "bg-coral/15 text-coral-deep", "In progress": "bg-sun/25 text-[#7a5200]", Resolved: "bg-mint text-forest" } as const;

export function Repairs({ data, reload, notify }: Ctx) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [sel, setSel] = useState<AdminRequest | null>(null);
  const list = data.requests.filter((r) => filter === "all" || r.status !== "Resolved");

  return (
    <div>
      <div className="flex gap-2" role="tablist">
        {(["open", "all"] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === f ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}>{f === "open" ? "Open queue" : "All requests"}</button>
        ))}
      </div>
      {list.length === 0 ? <p className="mt-6 rounded-3xl border border-dashed border-line bg-paper p-10 text-center text-ink-soft">No repair requests here.</p> : (
        <ul className="mt-4 space-y-3">
          {list.map((r) => (
            <li key={r.id} className="rounded-3xl border border-line bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.productName} <span className="font-normal text-ink-soft">&middot; {r.category}</span></p>
                  <p className="text-xs text-ink-soft">{r.customer}{r.phone ? `, ${r.phone}` : ""} &middot; {r.id} &middot; raised {when(r.createdAt)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${requestStyle[r.status]}`}>{r.status}</span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{r.description}</p>
              {r.note && <p className="mt-2 rounded-2xl bg-mint px-3 py-2 text-sm text-forest">Note: {r.note}</p>}
              <button onClick={() => setSel(r)} className="mt-3 rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">Update status</button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Update repair request">
        {sel && <RepairForm request={sel} onDone={async (m) => { setSel(null); notify(m); await reload(); }} />}
      </Modal>
    </div>
  );
}

function RepairForm({ request, onDone }: { request: AdminRequest; onDone: (m: string) => void }) {
  const [status, setStatus] = useState<AdminRequest["status"]>(request.status);
  const [note, setNote] = useState(request.note);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { ok, data: d } = await adminApi(`/api/admin/maintenance/${request.id}`, "PATCH", { status, note });
    if (ok) return onDone(`Request ${request.id} is now ${status}.`);
    setMsg(String(d.error ?? "Could not update."));
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">{request.productName}: {request.description}</p>
      <label className="block text-sm font-semibold">Status
        <select value={status} onChange={(e) => setStatus(e.target.value as AdminRequest["status"])} className={fieldCls}>{(["Open", "In progress", "Resolved"] as const).map((s) => <option key={s}>{s}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Note for the customer
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Technician visiting tomorrow 11 AM" className={fieldCls} />
      </label>
      <Err m={msg} />
      <Save busy={busy}>Save update</Save>
    </form>
  );
}

/* -------------------------------- Claims -------------------------------- */

const claimStyle = { Charged: "bg-sun/25 text-[#7a5200]", Disputed: "bg-coral/15 text-coral-deep", Upheld: "bg-sand text-ink", Waived: "bg-mint text-forest" } as const;

export function Claims({ data, reload, notify }: Ctx) {
  const [sel, setSel] = useState<AdminClaim | null>(null);
  const order = { Disputed: 0, Charged: 1, Upheld: 2, Waived: 3 } as const;
  const list = [...data.claims].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div>
      <p className="text-sm text-ink-soft">Damage charges are raised when you process a return. Customers can dispute them, and the amount is held until you decide.</p>
      {list.length === 0 ? <p className="mt-6 rounded-3xl border border-dashed border-line bg-paper p-10 text-center text-ink-soft">No damage claims yet.</p> : (
        <ul className="mt-4 space-y-3">
          {list.map((c) => (
            <li key={c.id} className="rounded-3xl border border-line bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.productName} <span className="font-normal text-ink-soft">&middot; {inr(c.amount)}</span></p>
                  <p className="text-xs text-ink-soft">{c.customer} &middot; {c.id} &middot; {when(c.createdAt)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${claimStyle[c.status]}`}>{c.status}</span>
              </div>
              <p className="mt-2 text-sm"><span className="font-semibold">Damage:</span> <span className="text-ink-soft">{c.note}</span></p>
              {c.disputeMessage && <p className="mt-2 rounded-2xl bg-coral/10 px-3 py-2 text-sm text-coral-deep"><span className="font-semibold">Customer says:</span> {c.disputeMessage}</p>}
              {c.resolutionNote && <p className="mt-2 rounded-2xl bg-mint px-3 py-2 text-sm text-forest"><span className="font-semibold">Decision:</span> {c.resolutionNote}</p>}
              {(c.status === "Charged" || c.status === "Disputed") && <button onClick={() => setSel(c)} className="mt-3 rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">Decide</button>}
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Decide on this claim">
        {sel && <DecideForm claim={sel} onDone={async (m) => { setSel(null); notify(m); await reload(); }} />}
      </Modal>
    </div>
  );
}

function DecideForm({ claim, onDone }: { claim: AdminClaim; onDone: (m: string) => void }) {
  const [decision, setDecision] = useState<"Upheld" | "Waived">(claim.status === "Disputed" ? "Waived" : "Upheld");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { ok, data: d } = await adminApi(`/api/admin/claims/${claim.id}`, "PATCH", { decision, note });
    if (ok) return onDone(decision === "Waived" ? "Charge waived. The full deposit is refundable." : "Charge upheld and deducted from the deposit.");
    setMsg(String(d.error ?? "Could not save the decision."));
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">{claim.productName}: {inr(claim.amount)} for {claim.note}</p>
      {claim.disputeMessage && <p className="rounded-2xl bg-coral/10 px-3 py-2 text-sm text-coral-deep">Customer says: {claim.disputeMessage}</p>}
      <fieldset className="grid grid-cols-2 gap-3">
        {(["Upheld", "Waived"] as const).map((d) => (
          <label key={d} className={`cursor-pointer rounded-2xl border-2 p-3 text-center text-sm font-semibold transition ${decision === d ? "border-forest bg-mint/50" : "border-line hover:border-moss"}`}>
            <input type="radio" name="decision" checked={decision === d} onChange={() => setDecision(d)} className="sr-only" />
            {d === "Upheld" ? "Uphold the charge" : "Waive the charge"}
          </label>
        ))}
      </fieldset>
      <label className="block text-sm font-semibold">Reason the customer will see
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={fieldCls} />
      </label>
      <Err m={msg} />
      <Save busy={busy}>Save decision</Save>
    </form>
  );
}

/* ------------------------------ Customers ------------------------------ */

export function Customers({ data, reload, notify }: Ctx) {
  async function toggle(id: string, name: string, disabled: boolean) {
    const { ok, data: d } = await adminApi(`/api/admin/users/${id}`, "PATCH", { disabled: !disabled });
    notify(ok ? `${name} ${disabled ? "can log in again" : "is suspended and cannot log in"}.` : String(d.error ?? "Could not update."));
    if (ok) await reload();
  }
  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line bg-sand/60 text-xs uppercase tracking-wide text-ink-soft">
          <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Items out</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3" /></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.users.map((u) => (
            <tr key={u.id} className={u.disabled ? "opacity-60" : ""}>
              <td className="px-4 py-3"><p className="font-semibold">{u.name} {u.role === "admin" && <span className="ml-1 rounded-full bg-forest px-2 py-0.5 text-[10px] font-bold text-white">ADMIN</span>}</p><p className="text-xs text-ink-soft">{u.email}</p></td>
              <td className="px-4 py-3">{u.phone || "-"}</td>
              <td className="px-4 py-3">{u.orders}</td>
              <td className="px-4 py-3">{u.itemsRented}</td>
              <td className="px-4 py-3 text-ink-soft">{when(u.joined)}</td>
              <td className="px-4 py-3 text-right">
                {u.role === "admin" ? <span className="inline-flex items-center gap-1 text-xs text-ink-soft"><ShieldCheck className="h-3.5 w-3.5" /> Protected</span> : (
                  <button onClick={() => toggle(u.id, u.name, u.disabled)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:border-coral hover:text-coral-deep">
                    <Ban className="h-3.5 w-3.5" /> {u.disabled ? "Restore" : "Suspend"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------- Areas -------------------------------- */

export function Areas({ data, reload, notify }: Ctx) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { ok, data: d } = await adminApi("/api/admin/areas", "POST", { name });
    setBusy(false);
    if (ok) { setName(""); notify(`${name} added. Customers can pick it at checkout.`); await reload(); }
    else setMsg(String(d.error ?? "Could not add the city."));
  }
  async function toggle(id: string, n: string, active: boolean) {
    const { ok, data: d } = await adminApi(`/api/admin/areas/${id}`, "PATCH", { active: !active });
    notify(ok ? `${n} ${active ? "switched off" : "switched on"}.` : String(d.error ?? "Could not update."));
    if (ok) await reload();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.areas.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-3xl border border-line bg-paper px-5 py-4">
            <span className="font-semibold">{a.name}</span>
            <button onClick={() => toggle(a.id, a.name, a.active)} role="switch" aria-checked={a.active} aria-label={`Deliver to ${a.name}`} className={`relative h-7 w-12 rounded-full transition ${a.active ? "bg-moss" : "bg-line"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${a.active ? "left-6" : "left-1"}`} />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="h-fit space-y-3 rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display text-xl font-semibold">Add a city</h2>
        <label className="block text-sm font-semibold">City name<input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} placeholder="Jaipur" /></label>
        <Err m={msg} />
        <Save busy={busy}>Add city</Save>
        <p className="text-xs text-ink-soft">Switching a city off hides it from checkout. Existing orders are not affected.</p>
      </form>
    </div>
  );
}
