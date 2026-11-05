"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ArrowLeft, Camera, Check, Copy, Download, ImagePlus, Lightbulb, RotateCcw, RotateCw, ShoppingBag, Sparkles, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import { ProductArt } from "@/components/ProductArt";
import dynamic from "next/dynamic";
import type { Problem, RoomItem, SceneHandle } from "@/components/room/Scene";
import { useCart } from "@/context/CartContext";
import { useCatalog } from "@/context/CatalogContext";
import type { TenureMonths } from "@/data/config";
import { tenures } from "@/data/config";
import type { Product } from "@/data/products";
import { inr, monthlyRent } from "@/lib/pricing";
import { colorName, crowding, readRoomColors, rgbToHex, scoreColor, sizeFit, type RGB } from "@/lib/roomColor";
import { dimsFor, isWallMounted } from "@/lib/roomDims";
import { calibrateFloor, clampInside, outsideBy, overlaps, type Calibration, type Pt } from "@/lib/roomMath";
import { makeSampleRoom } from "@/lib/sampleRoom";

// Three.js is only downloaded when the studio opens, so the start screen stays light.
const Scene = dynamic(() => import("@/components/room/Scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => <div className="grid aspect-[3/2] w-full animate-pulse place-items-center rounded-3xl bg-sand text-sm text-ink-soft">Loading the 3D room...</div>,
});

type Stage = "start" | "floor" | "studio";
type Photo = { url: string; w: number; h: number };
type Tab = "furniture" | "check";

const MAX_SIDE = 1400;

async function loadPhoto(file: File): Promise<Photo> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return { url: c.toDataURL("image/jpeg", 0.88), w: c.width, h: c.height };
}

function readColorsFromPhoto(photo: Photo, quad: Pt[]): Promise<{ floor: RGB; wall: RGB }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 480 / Math.max(photo.w, photo.h));
      const c = document.createElement("canvas");
      c.width = Math.round(photo.w * k);
      c.height = Math.round(photo.h * k);
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      resolve(readRoomColors(data, c.width, c.height, quad.map((p) => ({ x: p.x * k, y: p.y * k }))));
    };
    img.src = photo.url;
  });
}

const newId = () => `it-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function RoomStudio() {
  const { products } = useCatalog();
  const { add, lines: cartLines, setQty, setMonths } = useCart();

  const [stage, setStage] = useState<Stage>("start");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [quad, setQuad] = useState<Pt[]>([]);
  const [W, setW] = useState("12");
  const [D, setD] = useState("9");
  const [hfov, setHfov] = useState(65);
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [cal, setCal] = useState<Calibration | null>(null);
  const [colors, setColors] = useState<{ floor: RGB; wall: RGB } | null>(null);
  const [items, setItems] = useState<RoomItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("furniture");
  const [plan, setPlan] = useState<TenureMonths>(12);
  const [sort, setSort] = useState<"match" | "catalog">("match");
  const [brightness, setBrightness] = useState(1);
  const [lightAngle, setLightAngle] = useState(215);
  const [toast, setToast] = useState("");
  const sceneRef = useRef<SceneHandle>(null);

  const Wn = Math.max(0, Number(W) || 0), Dn = Math.max(0, Number(D) || 0);

  const say = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  /* ----------------------------- step 1: photo ----------------------------- */

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) return setError("Please choose a photo (JPG, PNG or WebP).");
    if (file.size > 20 * 1024 * 1024) return setError("That photo is over 20 MB. Please pick a smaller one.");
    setBusy(true);
    try {
      const p = await loadPhoto(file);
      setPhoto(p);
      setQuad([{ x: p.w * 0.3, y: p.h * 0.56 }, { x: p.w * 0.7, y: p.h * 0.56 }, { x: p.w * 0.92, y: p.h * 0.9 }, { x: p.w * 0.08, y: p.h * 0.9 }]);
      setIsSample(false);
      setHfov(65);
      setStage("floor");
    } catch {
      setError("We could not read that photo. Try a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  function useSample() {
    const s = makeSampleRoom();
    setPhoto({ url: s.url, w: s.width, h: s.height });
    setQuad(s.quad);
    setW(String(s.W));
    setD(String(s.D));
    setHfov(s.hfov);
    setIsSample(true);
    setError("");
    setStage("floor");
  }

  /* ----------------------------- step 2: floor ----------------------------- */

  const liveCal = useMemo(() => (photo && Wn > 0 && Dn > 0 ? calibrateFloor(quad, Wn, Dn, photo.w, photo.h, hfov) : null), [photo, quad, Wn, Dn, hfov]);

  async function startStudio() {
    if (!photo) return;
    if (Wn < 4 || Dn < 4 || Wn > 60 || Dn > 60) return setError("Enter the floor width and depth in feet, between 4 and 60.");
    if (!liveCal) return setError("The four dots need to form a four-sided floor shape. Drag them onto the floor corners in order: back-left, back-right, front-right, front-left.");
    setError("");
    setBusy(true);
    setColors(await readColorsFromPhoto(photo, quad));
    setCal(liveCal);
    setItems([]);
    setSelectedId(null);
    setTab("furniture");
    setBusy(false);
    setStage("studio");
  }

  /* ----------------------------- step 3: studio ----------------------------- */

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const footprint = useCallback((it: RoomItem) => {
    const p = productById.get(it.pid)!;
    const d = dimsFor(p);
    return { x: it.x, z: it.z, w: d.w, d: d.d, rot: it.rot, wall: isWallMounted(d) };
  }, [productById]);

  const problems = useMemo(() => {
    const out: Record<string, Problem | undefined> = {};
    const fps = items.map((it) => ({ id: it.id, fp: footprint(it) }));
    for (const a of fps) {
      if (outsideBy(a.fp, Wn, Dn) > 0.05) out[a.id] = "outside";
      else if (!a.fp.wall && fps.some((b) => b.id !== a.id && !b.fp.wall && overlaps(a.fp, b.fp))) out[a.id] = "overlap";
    }
    return out;
  }, [items, footprint, Wn, Dn]);

  const scored = useMemo(() => {
    if (!colors) return [];
    return products.map((p) => {
      const dims = dimsFor(p);
      const fit = sizeFit(dims, Wn, Dn);
      const color = scoreColor(p.tint, colors.floor, colors.wall);
      const rank = color.score - (fit.status === "Too big" ? 100 : fit.status === "Tight fit" ? 12 : 0);
      return { p, dims, fit, color, rank };
    });
  }, [products, colors, Wn, Dn]);

  const sorted = useMemo(() => (sort === "match" ? [...scored].sort((a, b) => b.rank - a.rank) : scored), [scored, sort]);

  /** Find a free spot, preferring the back wall, then the side walls, then anywhere. */
  const findSpot = useCallback((p: Product, current: RoomItem[]): { x: number; z: number; rot: number } => {
    const d = dimsFor(p);
    const others = current.map(footprint).filter((f) => !f.wall);
    const free = (x: number, z: number, rot: number) => {
      if (isWallMounted(d)) return true;
      const fp = { x, z, w: d.w, d: d.d, rot };
      return outsideBy(fp, Wn, Dn) < 0.01 && !others.some((o) => overlaps(fp, o));
    };
    const tries: { x: number; z: number; rot: number }[] = [];
    const gap = 0.3;
    for (let x = d.w / 2 + gap; x <= Wn - d.w / 2 - gap; x += 0.5) tries.push({ x, z: d.d / 2 + 0.15, rot: 0 });
    for (let z = d.w / 2 + gap; z <= Dn - d.w / 2 - gap; z += 0.5) tries.push({ x: d.d / 2 + 0.15, z, rot: Math.PI / 2 }, { x: Wn - d.d / 2 - 0.15, z, rot: -Math.PI / 2 });
    for (let z = d.d / 2 + 1; z <= Dn - d.d / 2 - 0.5; z += 0.75) for (let x = d.w / 2 + 0.5; x <= Wn - d.w / 2 - 0.5; x += 0.75) tries.push({ x, z, rot: 0 });
    // wide pieces first try the centre of the back wall
    tries.sort((a, b) => (Math.abs(a.x - Wn / 2) + (a.rot ? 99 : 0)) - (Math.abs(b.x - Wn / 2) + (b.rot ? 99 : 0)) || a.z - b.z);
    const hit = tries.find((t) => free(t.x, t.z, t.rot));
    const spot = hit ?? { x: Wn / 2, z: Dn / 2, rot: 0 };
    return isWallMounted(d) ? { x: Wn / 2, z: d.d / 2 + 0.1, rot: 0 } : spot;
  }, [footprint, Wn, Dn]);

  const place = useCallback((p: Product) => {
    setItems((cur) => {
      const spot = findSpot(p, cur);
      const item: RoomItem = { id: newId(), pid: p.id, ...spot };
      setSelectedId(item.id);
      return [...cur, item];
    });
  }, [findSpot]);

  function autoFurnish() {
    if (!scored.length) return;
    const pickBest = (kind: string) => scored.filter((s) => s.p.art === kind && s.fit.status !== "Too big").sort((a, b) => b.rank - a.rank)[0];
    const tv = pickBest("tv"), sofa = pickBest("sofa"), shelf = pickBest("shelf");
    const table = Wn * Dn >= 130 ? pickBest("dining") : pickBest("desk");
    let cur: RoomItem[] = [];

    // Try the layout we want first. If it does not fit, fall back to the nearest free spot.
    const put = (s: { p: Product } | undefined, want: { x: number; z: number; rot: number }) => {
      if (!s) return;
      const d = dimsFor(s.p);
      const fp = clampInside({ x: want.x, z: want.z, w: d.w, d: d.d, rot: want.rot }, Wn, Dn);
      const others = cur.map(footprint).filter((f) => !f.wall);
      const ok = isWallMounted(d) || (outsideBy(fp, Wn, Dn) < 0.01 && !others.some((o) => overlaps(fp, o)));
      const spot = ok ? { x: fp.x, z: fp.z, rot: want.rot } : findSpot(s.p, cur);
      cur = [...cur, { id: newId(), pid: s.p.id, ...spot }];
    };

    const tvDims = tv && dimsFor(tv.p);
    const sofaDims = sofa && dimsFor(sofa.p);
    if (tv && tvDims) put(tv, { x: Wn / 2, z: tvDims.d / 2 + 0.2, rot: 0 });
    // the sofa faces the TV from the middle of the room, or sits against the back wall when there is no TV
    if (sofa && sofaDims) {
      const z = tv && tvDims ? Math.min(Dn - sofaDims.d / 2 - 0.8, tvDims.d + 5.8) : sofaDims.d / 2 + 0.2;
      put(sofa, { x: Wn / 2, z, rot: tv ? Math.PI : 0 });
    }
    if (shelf) put(shelf, { x: dimsFor(shelf.p).d / 2 + 0.15, z: Dn * 0.3, rot: Math.PI / 2 });
    if (table) {
      const td = dimsFor(table.p);
      put(table, table.p.art === "dining" ? { x: Wn - td.w / 2 - 0.6, z: Dn * 0.5, rot: 0 } : { x: Wn - td.d / 2 - 0.15, z: Dn * 0.28, rot: -Math.PI / 2 });
    }
    setItems(cur);
    setSelectedId(null);
    setTab("check");
    say(`Furnished your hall with ${cur.length} pieces picked for its size and colours.`);
  }

  const move = useCallback((id: string, x: number, z: number) => {
    setItems((cur) => cur.map((it) => {
      if (it.id !== id) return it;
      const fp = footprint(it);
      const c = clampInside({ ...fp, x, z }, Wn, Dn);
      return { ...it, x: c.x, z: c.z };
    }));
  }, [footprint, Wn, Dn]);

  const rotate = useCallback((id: string, delta: number) => {
    setItems((cur) => cur.map((it) => {
      if (it.id !== id) return it;
      const rot = it.rot + delta;
      const c = clampInside({ ...footprint(it), rot }, Wn, Dn);
      return { ...it, rot, x: c.x, z: c.z };
    }));
  }, [footprint, Wn, Dn]);

  const remove = useCallback((id: string) => {
    setItems((cur) => cur.filter((it) => it.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const duplicate = useCallback((id: string) => {
    setItems((cur) => {
      const src = cur.find((i) => i.id === id);
      const p = src && productById.get(src.pid);
      if (!src || !p) return cur;
      const spot = findSpot(p, cur);
      const copy: RoomItem = { id: newId(), pid: src.pid, ...spot };
      setSelectedId(copy.id);
      return [...cur, copy];
    });
  }, [findSpot, productById]);

  // Keyboard shortcuts: Delete removes, R rotates, arrows nudge.
  useEffect(() => {
    if (stage !== "studio" || !selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const it = items.find((i) => i.id === selectedId);
      if (!it) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(selectedId); }
      else if (e.key.toLowerCase() === "r") rotate(selectedId, e.shiftKey ? -Math.PI / 12 : Math.PI / 12);
      else if (e.key === "ArrowLeft") { e.preventDefault(); move(selectedId, it.x - 0.25, it.z); }
      else if (e.key === "ArrowRight") { e.preventDefault(); move(selectedId, it.x + 0.25, it.z); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(selectedId, it.x, it.z - 0.25); }
      else if (e.key === "ArrowDown") { e.preventDefault(); move(selectedId, it.x, it.z + 0.25); }
      else if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, selectedId, items, remove, rotate, move]);

  async function download() {
    const blob = await sceneRef.current?.exportPng();
    if (!blob) return say("Could not create the picture. Please try again.");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rentease-room.png";
    a.click();
    URL.revokeObjectURL(url);
    say("Picture downloaded.");
  }

  function addAllToCart() {
    const counts = new Map<string, number>();
    for (const it of items) counts.set(it.pid, (counts.get(it.pid) ?? 0) + 1);
    // Set the exact quantity, so pressing the button twice never doubles the cart.
    for (const [pid, qty] of counts) {
      if (cartLines.some((l) => l.productId === pid)) { setMonths(pid, plan); setQty(pid, qty); }
      else add(pid, plan, qty);
    }
  }

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedProduct = selected ? productById.get(selected.pid) : null;
  const placedDims = items.map((it) => ({ ...dimsFor(productById.get(it.pid)!), wallMounted: isWallMounted(dimsFor(productById.get(it.pid)!)) }));
  const cov = crowding(placedDims, Wn, Dn);
  const totals = items.reduce((s, it) => {
    const p = productById.get(it.pid);
    return p ? { rent: s.rent + monthlyRent(p, plan), deposit: s.deposit + p.deposit } : s;
  }, { rent: 0, deposit: 0 });
  const problemCount = Object.values(problems).filter(Boolean).length;
  const placedPids = new Set(items.map((i) => i.pid));
  const suggestions = scored.filter((s) => !placedPids.has(s.p.id) && s.fit.status !== "Too big").sort((a, b) => b.rank - a.rank).slice(0, 3);

  /* -------------------------------- render -------------------------------- */

  if (stage === "start") return <Start busy={busy} error={error} onFile={onFile} onSample={useSample} />;

  if (stage === "floor" && photo) {
    return (
      <FloorStep
        photo={photo}
        quad={quad}
        setQuad={setQuad}
        W={W} D={D} setW={setW} setD={setD}
        hfov={hfov} setHfov={setHfov}
        cal={liveCal}
        isSample={isSample}
        error={error}
        busy={busy}
        onBack={() => { setStage("start"); setError(""); }}
        onNext={startStudio}
      />
    );
  }

  if (stage === "studio" && photo && cal && colors) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setStage("floor")} className="flex items-center gap-1.5 text-sm font-semibold text-moss hover:underline"><ArrowLeft className="h-4 w-4" /> Adjust the floor</button>
          <div className="flex flex-wrap gap-2">
            <button onClick={autoFurnish} className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral-deep"><Wand2 className="h-4 w-4" /> Furnish it for me</button>
            <button onClick={download} disabled={!items.length} className="flex items-center gap-1.5 rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white disabled:opacity-40"><Download className="h-4 w-4" /> Download picture</button>
          </div>
        </div>

        <AnimatePresence>
          {toast && <m.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="mt-4 flex items-center gap-2 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-forest"><Check className="h-4 w-4" /> {toast}</m.p>}
        </AnimatePresence>

        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_24rem]">
          <div className="min-w-0">
            <Scene
              handleRef={sceneRef}
              photoUrl={photo.url} imgW={photo.w} imgH={photo.h} cal={cal} W={Wn} D={Dn}
              items={items} selectedId={selectedId} products={products} problems={problems}
              brightness={brightness} lightAngle={lightAngle}
              onSelect={setSelectedId} onMove={move}
            />
            {items.length === 0 && <p className="mt-3 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">Pick a piece from the list and it appears on your floor. Drag it to move it. The <strong>Furnish it for me</strong> button places a sofa, shelf, table and TV that suit your hall.</p>}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-semibold">
                <span className="flex items-center gap-1.5"><Lightbulb className="h-4 w-4 text-moss" /> Room brightness</span>
                <input type="range" min={0.5} max={1.5} step={0.05} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="mt-2 w-full accent-[#c24424]" />
              </label>
              <label className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-semibold">
                <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-moss" /> Light direction</span>
                <input type="range" min={0} max={360} step={5} value={lightAngle} onChange={(e) => setLightAngle(Number(e.target.value))} className="mt-2 w-full accent-[#c24424]" />
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-soft">Match the shadows to the light in your photo. Your photo stays in your browser and is never uploaded.</p>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <AnimatePresence>
              {selected && selectedProduct && (
                <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3 rounded-3xl border-2 border-forest bg-paper p-4">
                  <p className="truncate text-sm font-semibold">{selectedProduct.name}</p>
                  <p className="text-xs text-ink-soft">{dimsFor(selectedProduct).w} x {dimsFor(selectedProduct).d} x {dimsFor(selectedProduct).h} ft. Drag it on the floor, or use the buttons.</p>
                  {problems[selected.id] && <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-coral/10 px-3 py-2 text-xs font-medium text-coral-deep"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {problems[selected.id] === "overlap" ? "This piece overlaps another one. Move it apart." : "This piece is outside the floor area."}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => rotate(selected.id, -Math.PI / 12)} aria-label="Rotate left" className="grid h-10 w-10 place-items-center rounded-full border border-line hover:border-moss"><RotateCcw className="h-4 w-4" /></button>
                    <button onClick={() => rotate(selected.id, Math.PI / 12)} aria-label="Rotate right" className="grid h-10 w-10 place-items-center rounded-full border border-line hover:border-moss"><RotateCw className="h-4 w-4" /></button>
                    <button onClick={() => rotate(selected.id, Math.PI / 2)} className="rounded-full border border-line px-3 text-xs font-semibold hover:border-moss">Turn 90°</button>
                    <button onClick={() => duplicate(selected.id)} aria-label="Duplicate" className="grid h-10 w-10 place-items-center rounded-full border border-line hover:border-moss"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => remove(selected.id)} aria-label="Remove" className="grid h-10 w-10 place-items-center rounded-full border border-line text-coral-deep hover:border-coral"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-2 text-[11px] text-ink-soft">Keys: arrows nudge, R rotates, Delete removes.</p>
                </m.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2" role="tablist" aria-label="Room Studio panels">
              {([["furniture", "Furniture"], ["check", `Room check${items.length ? ` (${items.length})` : ""}`]] as [Tab, string][]).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}>{label}</button>
              ))}
            </div>

            {tab === "furniture" ? (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2 text-xs text-ink-soft">
                  <span>{sorted.length} pieces, sized for your {Wn} x {Dn} ft hall</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as "match" | "catalog")} aria-label="Sort furniture" className="rounded-full border border-line bg-paper px-3 py-1.5 font-semibold text-ink">
                    <option value="match">Best match first</option>
                    <option value="catalog">Shop order</option>
                  </select>
                </div>
                <ul className="mt-3 max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                  {sorted.map(({ p, dims, fit, color }, i) => (
                    <li key={p.id}>
                      <button onClick={() => place(p)} className="group flex w-full gap-3 rounded-2xl border border-line bg-paper p-2.5 text-left transition hover:border-moss hover:shadow-md">
                        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-sand"><ProductArt kind={p.art} tint={p.tint} className="h-14 w-14" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">{p.name}{sort === "match" && i < 3 && fit.status !== "Too big" && <span className="rounded-full bg-coral px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Top pick</span>}</p>
                          <p className="text-xs text-ink-soft">{dims.w} x {dims.d} ft &middot; from {inr(monthlyRent(p, 12))}/mo</p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                            <span className={`rounded-full px-2 py-0.5 ${fit.status === "Fits well" ? "bg-mint text-forest" : fit.status === "Tight fit" ? "bg-sun/25 text-[#7a5200]" : "bg-coral/15 text-coral-deep"}`}>{fit.status}</span>
                            <span className={`rounded-full px-2 py-0.5 ${color.label === "Great match" ? "bg-mint text-forest" : color.label === "Good match" ? "bg-sand text-ink" : "bg-coral/15 text-coral-deep"}`}>{color.score}/100 colour</span>
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-3xl border border-line bg-paper p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-moss">Floor space used</p>
                  <div className="mt-2 flex items-end justify-between"><p className="font-display text-3xl font-semibold text-forest">{cov.percent}%</p><p className={`text-sm font-semibold ${cov.verdict === "Too crowded" ? "text-coral-deep" : "text-forest"}`}>{cov.verdict}</p></div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand"><div className={`h-full rounded-full transition-all ${cov.percent >= 55 ? "bg-coral" : cov.percent >= 40 ? "bg-sun" : "bg-moss"}`} style={{ width: `${Math.min(100, cov.percent)}%` }} /></div>
                  <p className="mt-2 text-xs text-ink-soft">Rooms feel best with 25 to 40% of the floor covered, so people can walk around.</p>
                </div>

                <div className="rounded-3xl border border-line bg-paper p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-moss">What we read from your photo</p>
                  <div className="mt-2 flex gap-3">
                    {([["Floor", colors.floor], ["Walls", colors.wall]] as [string, RGB][]).map(([label, c]) => (
                      <div key={label} className="flex items-center gap-2 text-sm"><span className="h-8 w-8 rounded-full border border-line" style={{ background: rgbToHex(c) }} aria-hidden /><span><span className="block font-semibold">{label}</span><span className="text-xs text-ink-soft">{colorName(c)}</span></span></div>
                    ))}
                  </div>
                </div>

                {problemCount > 0 && <p className="flex items-start gap-2 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {problemCount} {problemCount === 1 ? "piece needs" : "pieces need"} attention: overlapping or outside the floor.</p>}

                {items.length === 0 ? (
                  <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">Place a few pieces to see how well each one suits your hall.</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((it) => {
                      const s = scored.find((x) => x.p.id === it.pid);
                      if (!s) return null;
                      return (
                        <li key={it.id}>
                          <button onClick={() => { setSelectedId(it.id); }} className={`w-full rounded-2xl border bg-paper p-3 text-left text-sm transition hover:border-moss ${selectedId === it.id ? "border-forest" : "border-line"}`}>
                            <span className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{s.p.name}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.color.label === "Great match" ? "bg-mint text-forest" : s.color.label === "Good match" ? "bg-sand text-ink" : "bg-coral/15 text-coral-deep"}`}>{s.color.label} {s.color.score}</span></span>
                            <span className="mt-1 block text-xs text-ink-soft">{s.color.reason}</span>
                            <span className="mt-0.5 block text-xs text-ink-soft">{s.fit.note}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {suggestions.length > 0 && (
                  <div className="rounded-3xl border border-line bg-paper p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-moss">Would also suit your hall</p>
                    <ul className="mt-2 space-y-2">
                      {suggestions.map((s) => (
                        <li key={s.p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0"><span className="block truncate font-semibold">{s.p.name}</span><span className="text-xs text-ink-soft">{s.color.score}/100 colour. {s.fit.status}.</span></span>
                          <button onClick={() => place(s.p)} className="shrink-0 rounded-full border border-forest px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest hover:text-white">Place</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-3xl bg-forest p-4 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sun">Rent this room</p>
                    <select value={plan} onChange={(e) => setPlan(Number(e.target.value) as TenureMonths)} aria-label="Rental plan" className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white outline-none">
                      {tenures.map((t) => <option key={t.months} value={t.months} className="text-ink">{t.label}</option>)}
                    </select>
                  </div>
                  <p className="font-display mt-2 text-3xl font-semibold">{inr(totals.rent)}<span className="text-sm font-medium text-white/70"> /month</span></p>
                  <p className="text-xs text-white/70">{items.length} {items.length === 1 ? "item" : "items"}. Refundable deposit {inr(totals.deposit)}. Free delivery.</p>
                  <button onClick={addAllToCart} disabled={!items.length} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3 text-sm font-semibold text-white transition hover:bg-coral-deep disabled:opacity-40"><ShoppingBag className="h-4 w-4" /> Add all to cart</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  }
  return null;
}

/* ------------------------------- step 1 view ------------------------------- */

function Start({ busy, error, onFile, onSample }: { busy: boolean; error: string; onFile: (f: File | undefined) => void; onSample: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-coral-deep">New: Room Studio</p>
      <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">See it in your hall before you rent it</h1>
      <p className="mx-auto mt-4 max-w-xl text-ink-soft">Upload a photo of your empty room. Furniture appears in 3D at its real size, standing on your floor. We check what fits and what suits your colours.</p>

      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}
        className={`mt-8 grid cursor-pointer place-items-center rounded-[2rem] border-2 border-dashed px-6 py-14 transition ${over ? "border-coral bg-coral/5" : "border-line bg-paper hover:border-moss"}`}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <span className="grid h-16 w-16 place-items-center rounded-full bg-mint text-forest"><ImagePlus className="h-7 w-7" /></span>
        <span className="mt-4 text-lg font-semibold">{busy ? "Reading your photo..." : "Choose a photo or drop it here"}</span>
        <span className="mt-1 text-sm text-ink-soft">JPG, PNG or WebP. It stays on your device and is never uploaded.</span>
      </label>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{error}</p>}

      <p className="mt-6 text-sm text-ink-soft">No photo handy?</p>
      <button onClick={onSample} className="mt-2 rounded-full border border-forest px-6 py-3 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">Try it with a sample hall</button>

      <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
        {[
          ["1", "Take a good photo", "Stand in a corner, about chest height, and keep the whole floor in the picture."],
          ["2", "Mark the floor", "Drag four dots onto the floor corners and enter the room size in feet."],
          ["3", "Place and check", "Add furniture, move it around, and read the room check for fit and colour."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-3xl border border-line bg-paper p-5"><span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-bold text-white">{n}</span><p className="mt-3 font-semibold">{t}</p><p className="mt-1 text-sm text-ink-soft">{d}</p></div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- step 2 view ------------------------------- */

function FloorStep(props: {
  photo: Photo; quad: Pt[]; setQuad: (q: Pt[]) => void; W: string; D: string; setW: (v: string) => void; setD: (v: string) => void;
  hfov: number; setHfov: (v: number) => void; cal: Calibration | null; isSample: boolean; error: string; busy: boolean; onBack: () => void; onNext: () => void;
}) {
  const { photo, quad, setQuad, W, D, setW, setD, hfov, setHfov, cal, isSample, error, busy, onBack, onNext } = props;
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const labels = ["Back left", "Back right", "Front right", "Front left"];
  const Wn = Number(W) || 0, Dn = Number(D) || 0;

  const toImage = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(photo.w, Math.max(0, ((e.clientX - r.left) / r.width) * photo.w)), y: Math.min(photo.h, Math.max(0, ((e.clientY - r.top) / r.height) * photo.h)) };
  };

  const grid: [Pt, Pt][] = [];
  let ref3ft: Pt[] = [];
  if (cal && Wn > 0 && Dn > 0) {
    for (let x = 0; x <= Wn; x += 1) grid.push([cal.project([x, 0, 0]), cal.project([x, 0, Dn])]);
    for (let z = 0; z <= Dn; z += 1) grid.push([cal.project([0, 0, z]), cal.project([Wn, 0, z])]);
    const cx = Wn / 2 - 1.5, cz = Dn / 2 - 1.5;
    ref3ft = [[cx, cz], [cx + 3, cz], [cx + 3, cz + 3], [cx, cz + 3]].map(([x, z]) => cal.project([x, 0, z]));
  }
  const r = Math.max(10, photo.w / 70);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-moss hover:underline"><ArrowLeft className="h-4 w-4" /> Choose another photo</button>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">Mark your floor</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">{isSample ? "The corners of this sample hall are already marked. Check the grid lines, then continue." : "Drag the four dots onto the corners of the floor, in this order: back left, back right, front right, front left. If a corner is hidden behind something, put the dot where it would be."}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div ref={box} className="relative w-full touch-none select-none overflow-hidden rounded-3xl bg-sand" style={{ aspectRatio: `${photo.w} / ${photo.h}` }}
          onPointerMove={(e) => { if (active === null) return; const next = [...quad]; next[active] = toImage(e); setQuad(next); }}
          onPointerUp={() => setActive(null)} onPointerCancel={() => setActive(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={photo.url} alt="Your room" draggable={false} className="absolute inset-0 h-full w-full" />
          <svg viewBox={`0 0 ${photo.w} ${photo.h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <polygon points={quad.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(47,210,122,0.18)" stroke="#2fd27a" strokeWidth={photo.w / 300} />
            {grid.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.55)" strokeWidth={photo.w / 700} />)}
            {ref3ft.length === 4 && <polygon points={ref3ft.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(194,68,36,0.45)" stroke="#c24424" strokeWidth={photo.w / 400} />}
            {ref3ft.length === 4 && <text x={(ref3ft[0].x + ref3ft[2].x) / 2} y={(ref3ft[0].y + ref3ft[2].y) / 2} textAnchor="middle" fontSize={photo.w / 45} fontWeight={700} fill="#fff" stroke="rgba(0,0,0,0.5)" strokeWidth={photo.w / 600}>3 x 3 ft</text>}
            {quad.map((p, i) => (
              <g key={i} onPointerDown={(e) => { (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId); setActive(i); }} style={{ cursor: "grab" }}>
                <circle cx={p.x} cy={p.y} r={r * 1.9} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={r} fill="#fff" stroke="#c24424" strokeWidth={r / 3} />
                <text x={p.x} y={p.y - r * 1.5} textAnchor="middle" fontSize={r * 1.25} fontWeight={700} fill="#fff" stroke="rgba(0,0,0,0.65)" strokeWidth={r / 4} paintOrder="stroke">{labels[i]}</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-line bg-paper p-5">
            <h2 className="font-semibold">How big is the floor?</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">Width (ft)<input inputMode="decimal" value={W} onChange={(e) => setW(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-4 py-3 font-normal outline-none focus:border-moss" /><span className="mt-1 block text-[11px] font-normal text-ink-soft">Back wall, left to right</span></label>
              <label className="text-sm font-semibold">Depth (ft)<input inputMode="decimal" value={D} onChange={(e) => setD(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-4 py-3 font-normal outline-none focus:border-moss" /><span className="mt-1 block text-[11px] font-normal text-ink-soft">Back wall to you</span></label>
            </div>
            <p className="mt-3 text-xs text-ink-soft">Not sure? Count floor tiles, or pace it out: one big step is about 2.5 ft.</p>
          </div>
          <div className="rounded-3xl border border-line bg-paper p-5">
            <h2 className="flex items-center gap-1.5 font-semibold"><Camera className="h-4 w-4 text-moss" /> Photo angle</h2>
            <input type="range" min={50} max={90} step={1} value={hfov} onChange={(e) => setHfov(Number(e.target.value))} aria-label="Photo angle" className="mt-3 w-full accent-[#c24424]" />
            <div className="flex justify-between text-[11px] text-ink-soft"><span>Zoomed in</span><span>{hfov}°</span><span>Wide angle</span></div>
            <p className="mt-2 text-xs text-ink-soft">Leave it alone for normal phone photos. If the red 3 x 3 ft square looks too big or too small for the room, nudge this.</p>
          </div>
          {error && <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{error}</p>}
          {!cal && !error && <p className="rounded-2xl bg-sun/25 px-4 py-3 text-sm font-medium text-[#7a5200]">The dots do not form a floor shape yet. Keep them in order and make a four-sided shape.</p>}
          <button onClick={onNext} disabled={busy || !cal} className="w-full rounded-full bg-coral py-3.5 font-semibold text-white transition hover:bg-coral-deep disabled:opacity-50">{busy ? "Preparing..." : "Start placing furniture"}</button>
        </div>
      </div>
    </div>
  );
}
