"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Coffee, Frame, LampFloor, Maximize2, Minimize2, RectangleHorizontal, Save, Sprout } from "lucide-react";
import { ArrowLeft, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Download, ImagePlus, Lightbulb, RotateCcw, RotateCw, ShoppingBag, Sparkles, Trash2, TriangleAlert, Wand2 } from "lucide-react";
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
import { DECOR, decorProducts, isDecorId, type DecorKind } from "@/lib/roomDecor";
import { dimsFor, isWallMounted, takesNoFloor } from "@/lib/roomDims";
import { calibrateFloor, clampInside, outsideBy, overlaps, type Calibration, type Pt } from "@/lib/roomMath";
import { makeSampleRoom } from "@/lib/sampleRoom";

// Three.js is only downloaded when the studio opens, so the start screen stays light.
const Scene = dynamic(() => import("@/components/room/Scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => <div className="grid aspect-[3/2] w-full animate-pulse place-items-center rounded-3xl bg-sand text-sm text-ink-soft">Loading the 3D room...</div>,
});

type Stage = "start" | "floor" | "studio";
type Photo = { url: string; w: number; h: number };
type Tab = "furniture" | "decor" | "check";

const decorIcon: Record<DecorKind, typeof Sprout> = { rug: RectangleHorizontal, plant: Sprout, mirror: Frame, coffee: Coffee, lamp: LampFloor };

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

/** Everything needed to rebuild a room. Used for saved layouts and for keeping work through a login. */
type Snapshot = {
  photoUrl: string; imgW: number; imgH: number; quad: Pt[]; W: number; D: number; hfov: number; isSample: boolean;
  items: { pid: string; x: number; z: number; rot: number }[];
};
type SavedSummary = { id: string; name: string; itemCount: number; W: number; D: number; thumb: string; isSample: boolean; updatedAt: string };

const DRAFT_KEY = "rentease-room-draft";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Shrink the photo so a saved layout stays a few hundred KB. Returns the scale used. */
async function shrinkPhoto(url: string, w: number, h: number, maxSide = 1280): Promise<{ url: string; w: number; h: number; k: number }> {
  const k = Math.min(1, maxSide / Math.max(w, h));
  const img = await loadImage(url);
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/jpeg", 0.72), w: c.width, h: c.height, k };
}

async function makeThumb(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = Math.round((320 * bmp.height) / bmp.width);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  let out = c.toDataURL("image/jpeg", 0.6);
  if (out.length > 38_000) out = c.toDataURL("image/jpeg", 0.35);
  return out.length > 38_000 ? "" : out;
}

export function RoomStudio() {
  const { products } = useCatalog();
  // Decor is free and never part of the rent, so it lives beside the products rather than inside the catalogue.
  const allPieces = useMemo(() => [...products, ...decorProducts], [products]);
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
  const [step, setStep] = useState<0.25 | 1>(1);
  const [usePhotos, setUsePhotos] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bigPhoto, setBigPhoto] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState<SavedSummary[]>([]);
  const [savedMax, setSavedMax] = useState(5);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("My hall");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
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
      setSavedId(null);
      setSaveName("My hall");
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
    setSavedId(null);
    setSaveName("My hall");
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

  /* ------------------------- saved layouts and drafts ------------------------ */

  const refreshSaved = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/layouts");
      if (!res.ok) return;
      const data = await res.json();
      setSaved(data.layouts);
      setSavedMax(data.max);
    } catch { /* the list is a convenience, so a failure just leaves it empty */ }
  }, [user]);

  useEffect(() => {
    if (stage === "start") void Promise.resolve().then(refreshSaved);
  }, [stage, refreshSaved]);

  /** Rebuild the room from a snapshot and open the studio. */
  const enterStudio = useCallback(async (s: Snapshot, id: string | null, name: string) => {
    const url = s.isSample || !s.photoUrl ? makeSampleRoom().url : s.photoUrl;
    const ph: Photo = { url, w: s.imgW, h: s.imgH };
    const nextCal = calibrateFloor(s.quad, s.W, s.D, s.imgW, s.imgH, s.hfov);
    if (!nextCal) throw new Error("This layout's floor could not be rebuilt.");
    const ids = new Set(allPieces.map((p) => p.id));
    setPhoto(ph);
    setQuad(s.quad);
    setW(String(s.W));
    setD(String(s.D));
    setHfov(s.hfov);
    setIsSample(s.isSample);
    setColors(await readColorsFromPhoto(ph, s.quad));
    setCal(nextCal);
    setItems(s.items.filter((i) => ids.has(i.pid)).map((i) => ({ id: newId(), ...i })));
    setSelectedId(null);
    setTab("furniture");
    setSavedId(id);
    setSaveName(name);
    setStage("studio");
  }, [allPieces]);

  // After logging in from the save panel, bring back the room the customer was working on.
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(DRAFT_KEY); } catch { /* storage may be blocked */ }
    if (!raw || !products.length) return;
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    try {
      const draft = JSON.parse(raw) as Snapshot;
      void Promise.resolve().then(() => enterStudio(draft, null, "My hall")).then(() => say("Welcome back. Your room is restored. Press Save layout to keep it."));
    } catch { /* a damaged draft is simply dropped */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, when the catalogue is ready
  }, [products.length]);

  async function snapshot(): Promise<Snapshot> {
    if (!photo) throw new Error("No photo");
    const shrunk = isSample ? { url: "", w: photo.w, h: photo.h, k: 1 } : await shrinkPhoto(photo.url, photo.w, photo.h);
    return {
      photoUrl: shrunk.url, imgW: shrunk.w, imgH: shrunk.h,
      quad: quad.map((p) => ({ x: Math.round(p.x * shrunk.k * 10) / 10, y: Math.round(p.y * shrunk.k * 10) / 10 })),
      W: Wn, D: Dn, hfov, isSample,
      items: items.map((i) => ({ pid: i.pid, x: Math.round(i.x * 100) / 100, z: Math.round(i.z * 100) / 100, rot: Math.round(i.rot * 1000) / 1000 })),
    };
  }

  async function keepDraftAndLogin() {
    try {
      const s = await snapshot();
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(s));
    } catch { /* if it cannot be kept, the customer still logs in, they just start over */ }
    router.push("/login?next=/room-studio");
  }

  async function saveLayout(asNew: boolean) {
    setSaveError("");
    const name = saveName.trim();
    if (!name) return setSaveError("Give the layout a name.");
    setSaveBusy(true);
    try {
      const s = await snapshot();
      const blob = await sceneRef.current?.exportPng();
      const thumb = blob ? await makeThumb(blob) : "";
      const update = !asNew && savedId;
      const res = await fetch(update ? `/api/layouts/${savedId}` : "/api/layouts", {
        method: update ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items: s.items, quad: s.quad, W: s.W, D: s.D, hfov: s.hfov, imgW: s.imgW, imgH: s.imgH, isSample: s.isSample, photo: s.photoUrl, thumb }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setSaveError(data.error ?? "Could not save. Please try again.");
      setSavedId(data.layout.id);
      setSaveOpen(false);
      say(update ? `Updated "${name}".` : `Saved "${name}". Find it on the Room Studio start page.`);
    } catch {
      setSaveError("Could not save. Check your connection and try again.");
    } finally {
      setSaveBusy(false);
    }
  }

  async function openSaved(id: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/layouts/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const l = data.layout;
      await enterStudio({ photoUrl: l.photo, imgW: l.imgW, imgH: l.imgH, quad: l.quad, W: l.W, D: l.D, hfov: l.hfov, isSample: l.isSample, items: l.items }, l.id, l.name);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not open that layout.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSaved(id: string) {
    const res = await fetch(`/api/layouts/${id}`, { method: "DELETE" });
    if (res.ok) setSaved((cur) => cur.filter((l) => l.id !== id));
    else setError("Could not delete that layout.");
  }

  /* ----------------------------- step 3: studio ----------------------------- */

  const productById = useMemo(() => new Map(allPieces.map((p) => [p.id, p])), [allPieces]);

  const footprint = useCallback((it: RoomItem) => {
    const p = productById.get(it.pid)!;
    const d = dimsFor(p);
    return { x: it.x, z: it.z, w: d.w, d: d.d, rot: it.rot, wall: takesNoFloor(d) };
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
    if (d.flat) return { x: Wn / 2, z: Dn / 2, rot: 0 };
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
    say(`${p.name} added. Drag it in the photo, or use the Arrange box to place it exactly.`);
  }, [findSpot, say]);

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
    // Decor: a rug under the seating, a plant in the back corner, a mirror on the wall and a lamp beside the sofa.
    // Each piece tries its spots in order and takes the first free one. If none is free it is simply left out.
    const dec = (id: string, ...spots: { x: number; z: number; rot: number }[]) => {
      const piece = decorProducts.find((x) => x.id === id);
      if (!piece) return;
      const d = dimsFor(piece);
      if (d.flat && (d.w > Wn - 1 || d.d > Dn - 1)) return;
      for (const want of spots) {
        const fp = clampInside({ x: want.x, z: want.z, w: d.w, d: d.d, rot: want.rot }, Wn, Dn);
        const others = cur.map(footprint).filter((f) => !f.wall);
        if (takesNoFloor(d) || (outsideBy(fp, Wn, Dn) < 0.01 && !others.some((o) => overlaps(fp, o)))) {
          cur = [...cur, { id: newId(), pid: id, x: fp.x, z: fp.z, rot: want.rot }];
          return;
        }
      }
    };
    const sofaZ = sofaDims ? (tv && tvDims ? Math.min(Dn - sofaDims.d / 2 - 0.8, tvDims.d + 5.8) : sofaDims.d / 2 + 0.2) : Dn / 2;
    dec("d-rug-grey", { x: Wn / 2, z: Math.min(Dn - 2.6, sofaZ + 0.6), rot: 0 });
    dec("d-mirror", { x: Wn * 0.22, z: 0.2, rot: 0 });
    dec("d-plant", { x: Wn - 1, z: 1, rot: 0 }, { x: 1, z: Dn - 1.3, rot: 0 }, { x: Wn - 1, z: Dn - 1.3, rot: 0 }, { x: Wn * 0.35, z: 1, rot: 0 }, { x: Wn * 0.7, z: Dn - 1.3, rot: 0 });
    if (sofaDims) dec("d-lamp", { x: Math.min(Wn - 1, Wn / 2 + sofaDims.w / 2 + 0.9), z: sofaZ, rot: 0 }, { x: Math.max(1, Wn / 2 - sofaDims.w / 2 - 0.9), z: sofaZ, rot: 0 });
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

  /** Move a piece by a step in screen directions: right/left along the back wall, closer/farther from the camera. */
  const nudge = useCallback((id: string, dx: number, dz: number) => {
    setItems((cur) => cur.map((it) => {
      if (it.id !== id) return it;
      const c = clampInside({ ...footprint(it), x: it.x + dx, z: it.z + dz }, Wn, Dn);
      return { ...it, x: c.x, z: c.z };
    }));
  }, [footprint, Wn, Dn]);

  const setAngle = useCallback((id: string, deg: number) => {
    setItems((cur) => cur.map((it) => {
      if (it.id !== id) return it;
      const rot = (deg * Math.PI) / 180;
      const c = clampInside({ ...footprint(it), rot }, Wn, Dn);
      return { ...it, rot, x: c.x, z: c.z };
    }));
  }, [footprint, Wn, Dn]);

  /** Push a piece against a wall (facing into the room) or put it in the middle. */
  const snapTo = useCallback((id: string, where: "back" | "left" | "right" | "centre") => {
    setItems((cur) => cur.map((it) => {
      if (it.id !== id) return it;
      const pose =
        where === "back" ? { x: it.x, z: 0, rot: 0 }
        : where === "left" ? { x: 0, z: it.z, rot: Math.PI / 2 }
        : where === "right" ? { x: Wn, z: it.z, rot: -Math.PI / 2 }
        : { x: Wn / 2, z: Dn / 2, rot: it.rot };
      const c = clampInside({ ...footprint(it), ...pose }, Wn, Dn);
      return { ...it, x: c.x, z: c.z, rot: pose.rot };
    }));
  }, [footprint, Wn, Dn]);

  const remove = useCallback((id: string) => {
    setItems((cur) => cur.filter((it) => it.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setSelectedId(null);
    say("Removed every piece. The room is empty again.");
  }, [say]);

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
    for (const it of items) if (!isDecorId(it.pid)) counts.set(it.pid, (counts.get(it.pid) ?? 0) + 1);
    // Set the exact quantity, so pressing the button twice never doubles the cart.
    for (const [pid, qty] of counts) {
      if (cartLines.some((l) => l.productId === pid)) { setMonths(pid, plan); setQty(pid, qty); }
      else add(pid, plan, qty);
    }
  }

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedProduct = selected ? productById.get(selected.pid) : null;
  const placedDims = items.map((it) => ({ ...dimsFor(productById.get(it.pid)!), wallMounted: takesNoFloor(dimsFor(productById.get(it.pid)!)) }));
  const cov = crowding(placedDims, Wn, Dn);
  const rentable = items.filter((i) => !isDecorId(i.pid));
  const totals = rentable.reduce((s, it) => {
    const p = productById.get(it.pid);
    return p ? { rent: s.rent + monthlyRent(p, plan), deposit: s.deposit + p.deposit } : s;
  }, { rent: 0, deposit: 0 });
  const problemCount = Object.values(problems).filter(Boolean).length;
  const placedPids = new Set(items.map((i) => i.pid));
  const suggestions = scored.filter((s) => !placedPids.has(s.p.id) && s.fit.status !== "Too big").sort((a, b) => b.rank - a.rank).slice(0, 3);

  /* -------------------------------- render -------------------------------- */

  if (stage === "start") return <Start busy={busy} error={error} onFile={onFile} onSample={useSample} saved={saved} max={savedMax} loggedIn={!!user} onOpen={openSaved} onDelete={deleteSaved} />;

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
    const aspect = photo.w / photo.h;
    const deg = selected ? Math.round(((((selected.rot * 180) / Math.PI) % 360) + 360) % 360) : 0;
    const lightControls = (
      <div className="grid w-full grid-cols-2 gap-1.5 lg:gap-2">
              <label className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold lg:px-3 lg:py-2">
                <Lightbulb className="h-4 w-4 shrink-0 text-moss" /> <span className="shrink-0">Brightness</span>
                <input type="range" min={0.5} max={1.5} step={0.05} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="min-w-0 flex-1 accent-[#c24424]" />
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold lg:px-3 lg:py-2">
                <Sparkles className="h-4 w-4 shrink-0 text-moss" /> <span className="shrink-0">Light</span>
                <input type="range" min={0} max={360} step={5} value={lightAngle} onChange={(e) => setLightAngle(Number(e.target.value))} className="min-w-0 flex-1 accent-[#c24424]" />
              </label>
            </div>
    );
    const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line hover:border-moss lg:h-8 lg:w-8";
    const tool = "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition";
    return (
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-[112rem] flex-col overflow-hidden px-3 py-2 sm:px-5 lg:py-3">
        {/* One toolbar with everything for the photo: change it, fix the floor, furnish, save, download, clear */}
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setStage("floor")} className={`${tool} border border-line text-moss hover:border-moss`}><ArrowLeft className="h-4 w-4" /> Adjust floor</button>
          <label className={`${tool} cursor-pointer border border-line text-moss hover:border-moss`}>
            <ImagePlus className="h-4 w-4" /> Change photo
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button onClick={autoFurnish} className={`${tool} bg-coral text-white hover:bg-coral-deep`}><Wand2 className="h-4 w-4" /> Furnish it for me</button>

          <div className="relative shrink-0">
            <button onClick={() => { setSaveOpen((o) => !o); setSaveError(""); }} aria-expanded={saveOpen} className={`${tool} border border-forest text-forest hover:bg-forest hover:text-white`}><Save className="h-4 w-4" /> Save layout</button>
            {saveOpen && (
              <div className="fixed left-3 right-3 top-[8.75rem] z-40 rounded-3xl border-2 border-forest bg-paper p-4 shadow-xl lg:absolute lg:left-0 lg:right-auto lg:top-full lg:mt-2 lg:w-[26rem]">
                {!user ? (
                  <div className="space-y-3">
                    <p className="text-sm text-ink-soft">Log in to save this room to your account. Your photo and furniture are held for you while you log in.</p>
                    <button onClick={keepDraftAndLogin} className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral">Log in to save</button>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); void saveLayout(false); }} className="space-y-3">
                    <label className="block text-sm font-semibold">Layout name
                      <input value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={40} className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-4 py-2.5 font-normal outline-none focus:border-moss" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={saveBusy} className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral disabled:opacity-50">{saveBusy ? "Saving..." : savedId ? "Update saved layout" : "Save"}</button>
                      {savedId && <button type="button" disabled={saveBusy} onClick={() => void saveLayout(true)} className="rounded-full border border-forest px-5 py-2.5 text-sm font-semibold text-forest hover:bg-forest hover:text-white disabled:opacity-50">Save as new</button>}
                      <button type="button" onClick={() => setSaveOpen(false)} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-moss">Close</button>
                    </div>
                    <p className="text-xs text-ink-soft">Up to {savedMax} layouts. Your photo is saved to your account with the furniture positions.</p>
                  </form>
                )}
                {saveError && <p role="alert" className="mt-3 rounded-2xl bg-coral/10 px-4 py-2.5 text-sm font-medium text-coral-deep">{saveError}</p>}
              </div>
            )}
          </div>

          <button onClick={download} disabled={!items.length} className={`${tool} border border-forest text-forest hover:bg-forest hover:text-white disabled:opacity-40`}><Download className="h-4 w-4" /> Download picture</button>

          {confirmClear ? (
            <span className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-coral/10 py-1 pl-4 pr-1 text-sm font-semibold text-coral-deep">
              Remove all {items.length}?
              <button onClick={() => { clearAll(); setConfirmClear(false); }} className="rounded-full bg-coral-deep px-3.5 py-1.5 text-white">Yes</button>
              <button onClick={() => setConfirmClear(false)} className="rounded-full bg-paper px-3.5 py-1.5 text-ink">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} disabled={!items.length} className={`${tool} border border-line text-coral-deep hover:border-coral disabled:opacity-40`}><Trash2 className="h-4 w-4" /> Remove all</button>
          )}

          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap lg:ml-auto" role="group" aria-label="Look of the furniture">
            <span className="text-xs font-semibold text-ink-soft">Look</span>
            {([[true, "Photos"], [false, "3D"]] as [boolean, string][]).map(([v, l]) => (
              <button key={l} onClick={() => setUsePhotos(v)} aria-pressed={usePhotos === v} title={v ? "Use product photos where we have one" : "Use 3D models only"} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${usePhotos === v ? "bg-forest text-white" : "bg-sand text-ink-soft"}`}>{l}</button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {toast && <m.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="fixed bottom-4 left-1/2 z-50 flex w-[min(34rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center gap-2 rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white shadow-xl"><Check className="h-4 w-4 shrink-0" /> {toast}</m.p>}
        </AnimatePresence>

        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 lg:mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-4">
          <div className="flex min-w-0 shrink-0 flex-col items-center gap-2 lg:min-h-0 lg:shrink lg:justify-center">
            <div
              className={`relative ${bigPhoto ? "w-[min(100%,calc((60dvh)*var(--ar)))]" : "w-[min(100%,calc((38dvh)*var(--ar)))]"} lg:w-[min(100%,calc((100dvh_-_12.5rem)*var(--ar)))]`}
              style={{ "--ar": aspect } as React.CSSProperties}
            >
              <div className="relative">
                <button onClick={() => setBigPhoto((b) => !b)} aria-pressed={bigPhoto} aria-label={bigPhoto ? "Make the photo smaller" : "Make the photo bigger"} className="absolute bottom-2 right-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-forest/85 text-white shadow-md lg:hidden">{bigPhoto ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
                <Scene
                  handleRef={sceneRef}
                  photoUrl={photo.url} imgW={photo.w} imgH={photo.h} cal={cal} W={Wn} D={Dn}
                  items={items} selectedId={selectedId} products={allPieces} problems={problems}
                  brightness={brightness} lightAngle={lightAngle} usePhotos={usePhotos}
                  onSelect={setSelectedId} onMove={move}
                />
                {/* Numbered tags so every piece in the photo matches its row in the list */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                  {items.map((it, i) => {
                    const p = productById.get(it.pid);
                    if (!p) return null;
                    const at = cal.project([it.x, dimsFor(p).h + 0.4 + (dimsFor(p).lift ?? 0), it.z]);
                    const on = it.id === selectedId;
                    return (
                      <button
                        key={it.id}
                        onClick={() => setSelectedId(it.id)}
                        aria-label={`Select ${p.name}`}
                        className={`pointer-events-auto absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold shadow-md transition ${on ? "scale-125 bg-forest text-white" : problems[it.id] ? "bg-coral text-white" : "bg-white text-forest hover:scale-110"}`}
                        style={{ left: `${(at.x / photo.w) * 100}%`, top: `${(at.y / photo.h) * 100}%` }}
                      >{i + 1}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            {items.length === 0 && (
              <p className="hidden rounded-2xl bg-sand px-4 py-2.5 text-sm text-ink-soft sm:block lg:w-full"><strong className="text-ink">Start:</strong> tap a piece in the furniture list, then drag it in the photo or use the Arrange box. <strong className="text-ink">Furnish it for me</strong> fills the room for you.</p>
            )}

            <div className="hidden w-full lg:block">{lightControls}</div>
          </div>

          <aside className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <AnimatePresence>
              {selected && selectedProduct && (
                <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="order-last shrink-0 rounded-3xl border-2 border-forest bg-paper p-3 lg:order-first lg:p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-moss">Arrange piece {items.findIndex((i) => i.id === selected.id) + 1} &middot; {dimsFor(selectedProduct).w} x {dimsFor(selectedProduct).d} x {dimsFor(selectedProduct).h} ft</p>
                      <p className="truncate text-sm font-semibold">{selectedProduct.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => setEditOpen((o) => !o)} aria-expanded={editOpen} aria-label={editOpen ? "Hide edit options" : "Show edit options"} className="flex h-8 items-center gap-1 rounded-full border border-forest px-3 text-xs font-semibold text-forest lg:hidden">{editOpen ? "Hide" : "Edit"}<ChevronUp className={`h-3.5 w-3.5 transition ${editOpen ? "rotate-180" : ""}`} /></button>
                      <button onClick={() => setSelectedId(null)} className="rounded-full bg-forest px-3.5 py-1.5 text-xs font-semibold text-white">Done</button>
                    </div>
                  </div>
                  <div className={editOpen ? "" : "hidden lg:block"}>
                  {problems[selected.id] && <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-coral/10 px-3 py-1.5 text-xs font-medium text-coral-deep"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {problems[selected.id] === "overlap" ? "Overlaps another piece. Move it apart." : "Outside the floor area."}</p>}

                  <div className="mt-2.5 flex items-center gap-1.5" role="group" aria-label="Move piece">
                    <button onClick={() => nudge(selected.id, -step, 0)} aria-label="Move left" title="Left" className={iconBtn}><ChevronLeft className="h-4 w-4" /></button>
                    <button onClick={() => nudge(selected.id, 0, -step)} aria-label="Move farther from you" title="Farther" className={iconBtn}><ChevronUp className="h-4 w-4" /></button>
                    <button onClick={() => nudge(selected.id, 0, step)} aria-label="Move closer to you" title="Closer" className={iconBtn}><ChevronDown className="h-4 w-4" /></button>
                    <button onClick={() => nudge(selected.id, step, 0)} aria-label="Move right" title="Right" className={iconBtn}><ChevronRight className="h-4 w-4" /></button>
                    <span className="mx-1 h-6 w-px bg-line" aria-hidden />
                    {([[0.25, "3 in"], [1, "1 ft"]] as [0.25 | 1, string][]).map(([v, l]) => (
                      <button key={v} onClick={() => setStep(v)} aria-pressed={step === v} aria-label={`Step ${l}`} className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${step === v ? "bg-forest text-white" : "bg-sand text-ink-soft"}`}>{l}</button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button onClick={() => rotate(selected.id, -Math.PI / 2)} aria-label="Turn 90 degrees left" className={iconBtn}><RotateCcw className="h-4 w-4" /></button>
                    <input type="range" min={0} max={359} step={1} value={deg} onChange={(e) => setAngle(selected.id, Number(e.target.value))} aria-label={`Turn, ${deg} degrees`} className="min-w-0 flex-1 accent-[#c24424]" />
                    <button onClick={() => rotate(selected.id, Math.PI / 2)} aria-label="Turn 90 degrees right" className={iconBtn}><RotateCw className="h-4 w-4" /></button>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold text-ink-soft">{deg}°</span>
                  </div>
                  <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] lg:flex-wrap [&::-webkit-scrollbar]:hidden">
                    {([["back", "Back wall"], ["left", "Left"], ["right", "Right"], ["centre", "Centre"]] as const).map(([w, l]) => (
                      <button key={w} onClick={() => snapTo(selected.id, w)} className="shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs font-semibold hover:border-moss">{l}</button>
                    ))}
                    <span className="mx-0.5 w-px shrink-0 self-stretch bg-line" aria-hidden />
                    <button onClick={() => duplicate(selected.id)} className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs font-semibold hover:border-moss"><Copy className="h-3 w-3" /> Copy</button>
                    <button onClick={() => remove(selected.id)} className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-coral-deep hover:border-coral"><Trash2 className="h-3 w-3" /> Remove</button>
                  </div>
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            <div className="flex shrink-0 gap-2" role="tablist" aria-label="Room Studio panels">
              {([["furniture", "Furniture"], ["decor", "Decor"], ["check", `Check${items.length ? ` (${items.length})` : ""}`]] as [Tab, string][]).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${tab === id ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}>{label}</button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {tab === "furniture" ? (
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-ink-soft">
                    <span>{sorted.length} pieces for your {Wn} x {Dn} ft room</span>
                    <select value={sort} onChange={(e) => setSort(e.target.value as "match" | "catalog")} aria-label="Sort furniture" className="rounded-full border border-line bg-paper px-3 py-1.5 font-semibold text-ink">
                      <option value="match">Best match first</option>
                      <option value="catalog">Shop order</option>
                    </select>
                  </div>
                  {items.length > 0 && (
                    <div className="mt-2 rounded-2xl border border-line bg-paper p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-moss">In your room ({items.length}). Tap one to arrange it</p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {items.map((it, i) => {
                          const p = productById.get(it.pid);
                          if (!p) return null;
                          return (
                            <li key={it.id}>
                              <button onClick={() => setSelectedId(it.id)} aria-pressed={selectedId === it.id} className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-semibold transition ${selectedId === it.id ? "border-forest bg-forest text-white" : problems[it.id] ? "border-coral bg-coral/10 text-coral-deep" : "border-line hover:border-moss"}`}>
                                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${selectedId === it.id ? "bg-white text-forest" : "bg-mint text-forest"}`}>{i + 1}</span>
                                <span className="max-w-[8rem] truncate">{p.name}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  <ul className="mt-2 space-y-2">
                    {sorted.map(({ p, dims, fit, color }, i) => (
                      <li key={p.id}>
                        <button onClick={() => place(p)} className="group flex w-full gap-3 rounded-2xl border border-line bg-paper p-2 text-left transition hover:border-moss hover:shadow-md">
                          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-sand"><ProductArt kind={p.art} tint={p.tint} className="h-12 w-12" /></div>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">{p.name}{sort === "match" && i < 3 && fit.status !== "Too big" && <span className="rounded-full bg-coral px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Top pick</span>}</p>
                            <p className="text-xs text-ink-soft">{dims.w} x {dims.d} ft &middot; from {inr(monthlyRent(p, 12))}/mo</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                              <span className={`rounded-full px-2 py-0.5 ${fit.status === "Fits well" ? "bg-mint text-forest" : fit.status === "Tight fit" ? "bg-sun/25 text-[#7a5200]" : "bg-coral/15 text-coral-deep"}`}>{fit.status}</span>
                              <span className={`rounded-full px-2 py-0.5 ${color.label === "Great match" ? "bg-mint text-forest" : color.label === "Good match" ? "bg-sand text-ink" : "bg-coral/15 text-coral-deep"}`}>{color.score}/100 colour</span>
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : tab === "decor" ? (
                <div>
                  <p className="text-xs text-ink-soft">Free finishing touches. Decor is not rented, not in your cart and not in the price. It just makes the room look lived in.</p>
                  <ul className="mt-2 space-y-2">
                    {DECOR.map((d) => {
                      const Icon = decorIcon[d.kind];
                      const on = items.filter((i) => i.pid === d.id).length;
                      return (
                        <li key={d.id}>
                          <button onClick={() => place(decorProducts.find((x) => x.id === d.id)!)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper p-2 text-left transition hover:border-moss hover:shadow-md">
                            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl" style={{ background: `${d.tint}26`, color: d.tint }}><Icon className="h-7 w-7" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{d.name}</span>
                              <span className="block text-xs text-ink-soft">{d.blurb}</span>
                              <span className="mt-0.5 block text-[11px] font-semibold text-moss">{`${d.dims.w} x ${d.dims.d} ft · free${on ? ` · ${on} in your room` : ""}`}</span>
                            </span>
                            <span className="shrink-0 rounded-full border border-forest px-3 py-1 text-xs font-semibold text-forest">Place</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="lg:hidden">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-moss">Match the light in your photo</p>
                    {lightControls}
                  </div>
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
                    <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">Place a few pieces to see how well each one suits your room.</p>
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-moss">Would also suit your room</p>
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
                    <p className="text-xs text-white/70">{rentable.length} {rentable.length === 1 ? "item" : "items"} to rent{items.length > rentable.length ? `, ${items.length - rentable.length} free decor` : ""}. Refundable deposit {inr(totals.deposit)}. Free delivery.</p>
                    <button onClick={addAllToCart} disabled={!rentable.length} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3 text-sm font-semibold text-white transition hover:bg-coral-deep disabled:opacity-40"><ShoppingBag className="h-4 w-4" /> Add all to cart</button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }
  return null;
}

/* ------------------------------- step 1 view ------------------------------- */

function Start({ busy, error, onFile, onSample, saved, max, loggedIn, onOpen, onDelete }: {
  busy: boolean; error: string; onFile: (f: File | undefined) => void; onSample: () => void;
  saved: SavedSummary[]; max: number; loggedIn: boolean; onOpen: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [over, setOver] = useState(false);
  const [sure, setSure] = useState<string | null>(null);
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

      {loggedIn && saved.length > 0 && (
        <section className="mt-10 text-left" aria-labelledby="saved-h">
          <h2 id="saved-h" className="font-display text-2xl font-semibold">Your saved layouts <span className="text-base font-medium text-ink-soft">({saved.length} of {max})</span></h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {saved.map((l) => (
              <li key={l.id} className="overflow-hidden rounded-3xl border border-line bg-paper">
                <div className="aspect-[3/2] bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small data URL preview */}
                  {l.thumb && <img src={l.thumb} alt={`Preview of ${l.name}`} className="h-full w-full object-cover" />}
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold">{l.name}</p>
                  <p className="text-xs text-ink-soft">{l.itemCount} {l.itemCount === 1 ? "piece" : "pieces"} &middot; {l.W} x {l.D} ft &middot; {new Date(l.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => onOpen(l.id)} disabled={busy} className="flex-1 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-coral disabled:opacity-50">{busy ? "Opening..." : "Open"}</button>
                    {sure === l.id ? (
                      <button onClick={() => { onDelete(l.id); setSure(null); }} className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Yes, delete</button>
                    ) : (
                      <button onClick={() => setSure(l.id)} aria-label={`Delete ${l.name}`} className="grid h-10 w-10 place-items-center rounded-full border border-line text-coral-deep hover:border-coral"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!loggedIn && <p className="mt-8 text-sm text-ink-soft"><Link href="/login?next=/room-studio" className="font-semibold text-forest underline">Log in</Link> to keep your rooms and come back to them later.</p>}

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
  const [shownW, setShownW] = useState(360);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setShownW(Math.max(80, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
  // photo pixels per screen pixel, so dots, labels and lines stay a touchable size even when a tall photo is shown narrow
  const k = photo.w / shownW;
  const r = Math.max(10, photo.w / 70, 9 * k);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-moss hover:underline"><ArrowLeft className="h-4 w-4" /> Choose another photo</button>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">Mark your floor</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">{isSample ? "The corners of this sample hall are already marked. Check the grid lines, then continue." : "Drag the four dots onto the corners of the floor, in this order: back left, back right, front right, front left. If a corner is hidden behind something, put the dot where it would be."}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div ref={box} className="relative mx-auto w-[min(100%,calc((56dvh)*var(--ar)))] touch-none select-none overflow-hidden rounded-3xl bg-sand lg:w-[min(100%,calc((100dvh_-_15rem)*var(--ar)))]" style={{ aspectRatio: `${photo.w} / ${photo.h}`, "--ar": photo.w / photo.h } as React.CSSProperties}
          onPointerMove={(e) => { if (active === null) return; const next = [...quad]; next[active] = toImage(e); setQuad(next); }}
          onPointerUp={() => setActive(null)} onPointerCancel={() => setActive(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={photo.url} alt="Your room" draggable={false} className="absolute inset-0 h-full w-full" />
          <svg viewBox={`0 0 ${photo.w} ${photo.h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <polygon points={quad.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(47,210,122,0.18)" stroke="#2fd27a" strokeWidth={Math.max(photo.w / 300, 1.6 * k)} />
            {grid.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.55)" strokeWidth={Math.max(photo.w / 700, 0.8 * k)} />)}
            {ref3ft.length === 4 && <polygon points={ref3ft.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(194,68,36,0.45)" stroke="#c24424" strokeWidth={Math.max(photo.w / 400, 1.4 * k)} />}
            {ref3ft.length === 4 && <text x={(ref3ft[0].x + ref3ft[2].x) / 2} y={(ref3ft[0].y + ref3ft[2].y) / 2} textAnchor="middle" fontSize={Math.max(photo.w / 45, 11 * k)} fontWeight={700} fill="#fff" stroke="rgba(0,0,0,0.5)" strokeWidth={Math.max(photo.w / 600, 0.8 * k)}>3 x 3 ft</text>}
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
