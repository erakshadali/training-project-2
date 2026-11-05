"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { Product } from "@/data/products";
import { dimsFor } from "@/lib/roomDims";
import type { Calibration } from "@/lib/roomMath";
import { buildModel, disposeModel } from "@/components/room/models";

export type RoomItem = { id: string; pid: string; x: number; z: number; rot: number };
export type Problem = "overlap" | "outside";

export type SceneHandle = { exportPng: () => Promise<Blob | null> };

type Props = {
  photoUrl: string;
  imgW: number;
  imgH: number;
  cal: Calibration;
  W: number;
  D: number;
  items: RoomItem[];
  selectedId: string | null;
  products: Product[];
  problems: Record<string, Problem | undefined>;
  brightness: number;
  lightAngle: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
  /** Receives { exportPng }. A prop, not a ref, so the component can be loaded lazily. */
  handleRef?: React.Ref<SceneHandle>;
};

type Live = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  models: Map<string, { group: THREE.Group; pid: string }>;
  outline: THREE.Group;
  render: () => void;
};

/** The 3D layer drawn on top of the room photo. It uses the camera recovered from the floor corners. */
export function Scene(props: Props) {
  const { photoUrl, imgW, imgH, cal, W, D } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const live = useRef<Live | null>(null);
  const latest = useRef(props);
  const photo = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const img = new Image();
    img.src = photoUrl;
    photo.current = img;
  }, [photoUrl]);

  useImperativeHandle(props.handleRef, () => ({
    async exportPng() {
      const l = live.current, img = photo.current;
      if (!l || !img) return null;
      await img.decode().catch(() => undefined);
      const out = document.createElement("canvas");
      out.width = imgW;
      out.height = imgH;
      const ctx = out.getContext("2d")!;
      ctx.drawImage(img, 0, 0, imgW, imgH);
      l.outline.visible = false;
      l.render();
      ctx.drawImage(l.renderer.domElement, 0, 0, imgW, imgH);
      l.outline.visible = true;
      l.render();
      ctx.font = "600 22px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 6;
      ctx.fillText("Made with RentEase Room Studio", 24, imgH - 24);
      return new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), "image/png"));
    },
  }));

  // Build the renderer and camera once per calibration.
  useEffect(() => {
    const host = wrap.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(cal.vfov, imgW / imgH, 0.1, 400);
    camera.matrixAutoUpdate = false;
    camera.matrix.fromArray(cal.cameraMatrix);
    camera.matrixWorldNeedsUpdate = true;
    camera.updateMatrixWorld(true);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb8a890, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const reach = Math.max(W, D) * 1.2;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 80 });
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 7;
    sun.target.position.set(W / 2, 0, D / 2);
    scene.add(sun, sun.target);

    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(W + 8, D + 8), new THREE.ShadowMaterial({ opacity: 0.26 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.set(W / 2, 0.002, D / 2);
    catcher.receiveShadow = true;
    scene.add(catcher);

    const outline = new THREE.Group();
    scene.add(outline);

    let queued = false;
    const draw = () => renderer.render(scene, camera);
    const render = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        draw();
      });
    };
    const l: Live = { renderer, scene, camera, hemi, sun, models: new Map(), outline, render: draw };
    live.current = l;
    const request = render;

    const resize = () => {
      const w = host.clientWidth;
      renderer.setSize(w, (w * imgH) / imgW, false);
      request();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // ---- picking and dragging on the floor
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    let drag: { id: string; offX: number; offZ: number } | null = null;

    const aim = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const itemAt = (): string | null => {
      const groups = [...l.models.values()].map((m) => m.group);
      const hit = ray.intersectObjects(groups, true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && !o.userData.itemId) o = o.parent;
      return (o?.userData.itemId as string) ?? null;
    };

    const down = (e: PointerEvent) => {
      aim(e);
      const id = itemAt();
      latest.current.onSelect(id);
      if (!id) return;
      const g = l.models.get(id)!.group;
      if (ray.ray.intersectPlane(floorPlane, hitPoint)) {
        drag = { id, offX: hitPoint.x - g.position.x, offZ: hitPoint.z - g.position.z };
        renderer.domElement.setPointerCapture(e.pointerId);
        renderer.domElement.style.cursor = "grabbing";
      }
    };
    const move = (e: PointerEvent) => {
      aim(e);
      if (drag) {
        if (ray.ray.intersectPlane(floorPlane, hitPoint)) latest.current.onMove(drag.id, hitPoint.x - drag.offX, hitPoint.z - drag.offZ);
      } else {
        renderer.domElement.style.cursor = itemAt() ? "grab" : "default";
      }
    };
    const up = (e: PointerEvent) => {
      if (drag) renderer.domElement.releasePointerCapture(e.pointerId);
      drag = null;
      renderer.domElement.style.cursor = "default";
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      l.models.forEach((m) => disposeModel(m.group));
      disposeModel(outline);
      catcher.geometry.dispose();
      (catcher.material as THREE.Material).dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      live.current = null;
    };
  }, [cal, W, D, imgW, imgH]);

  // Keep the 3D objects in step with the items.
  const { items, selectedId, products, problems, brightness, lightAngle } = props;
  useEffect(() => {
    const l = live.current;
    if (!l) return;
    const byId = new Map(products.map((p) => [p.id, p]));
    const seen = new Set<string>();

    for (const it of items) {
      const product = byId.get(it.pid);
      if (!product) continue;
      seen.add(it.id);
      let m = l.models.get(it.id);
      if (!m) {
        const group = new THREE.Group();
        group.userData.itemId = it.id;
        group.add(buildModel(product.art, product.tint, dimsFor(product)));
        l.scene.add(group);
        m = { group, pid: it.pid };
        l.models.set(it.id, m);
      }
      m.group.position.set(it.x, 0, it.z);
      m.group.rotation.y = it.rot;
    }
    for (const [id, m] of l.models) {
      if (!seen.has(id)) {
        l.scene.remove(m.group);
        disposeModel(m.group);
        l.models.delete(id);
      }
    }

    // Selection outline on the floor.
    l.outline.children.slice().forEach((c) => {
      l.outline.remove(c);
      disposeModel(c);
    });
    const sel = items.find((i) => i.id === selectedId);
    const selProduct = sel && byId.get(sel.pid);
    if (sel && selProduct) {
      const { w, d } = dimsFor(selProduct);
      const bad = problems[sel.id];
      const color = bad ? 0xff4d3a : 0x2fd27a;
      const t = 0.07;
      const edges: [number, number, number, number][] = [[w + t, t, 0, -d / 2], [w + t, t, 0, d / 2], [t, d + t, -w / 2, 0], [t, d + t, w / 2, 0]];
      for (const [bw, bd, ox, oz] of edges) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.03, bd), new THREE.MeshBasicMaterial({ color }));
        m.position.set(ox, 0.03, oz);
        l.outline.add(m);
      }
      l.outline.position.set(sel.x, 0, sel.z);
      l.outline.rotation.y = sel.rot;
    }

    l.hemi.intensity = 0.9 * brightness;
    l.sun.intensity = 1.05 * brightness;
    const a = (lightAngle * Math.PI) / 180;
    l.sun.position.set(W / 2 + Math.cos(a) * 14, 18, D / 2 + Math.sin(a) * 14);
    l.render();
  });

  return (
    <div ref={wrap} className="relative w-full select-none overflow-hidden rounded-3xl bg-sand" style={{ aspectRatio: `${imgW} / ${imgH}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the photo is a local data URL, so next/image cannot optimise it */}
      <img src={photoUrl} alt="Your room" draggable={false} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
