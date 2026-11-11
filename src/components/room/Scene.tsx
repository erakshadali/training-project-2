"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Product } from "@/data/products";
import { dimsFor } from "@/lib/roomDims";
import { photoSize, ROOM_PHOTOS } from "@/lib/roomPhotos";
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
  /** Show product photos where we have them. Off shows the 3D models only. */
  usePhotos?: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
  /** Called once when a drag of a piece begins, so the editor can record an undo step. */
  onDragStart?: (id: string) => void;
  /** Receives { exportPng }. A prop, not a ref, so the component can be loaded lazily. */
  handleRef?: React.Ref<SceneHandle>;
};

type Live = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  models: Map<string, { group: THREE.Group; pid: string; kind: "model" | "photo" }>;
  outline: THREE.Group;
  /** A soft round shadow texture shared by every model, drawn under it on the floor. */
  shadeTex: THREE.CanvasTexture;
  render: () => void;
};

/** A soft dark blob that fades out to nothing at the edge, used as a contact shadow. */
function makeShadeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, "rgba(0,0,0,0.5)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** The 3D layer drawn on top of the room photo. It uses the camera recovered from the floor corners. */
export function Scene(props: Props) {
  const { photoUrl, imgW, imgH, cal, W, D } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const live = useRef<Live | null>(null);
  const latest = useRef(props);
  const photo = useRef<HTMLImageElement | null>(null);
  // Product photo textures are cached; null means the file could not be loaded.
  const textures = useRef(new Map<string, THREE.Texture | null>());
  const [, setTick] = useState(0);

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

    // A soft studio environment gives metal, glass and screens something to reflect, so appliances stop looking flat.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envMap;
    scene.environmentIntensity = 0.4;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb8a890, 0.62);
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
    const shadeTex = makeShadeTexture();
    const l: Live = { renderer, scene, camera, hemi, sun, models: new Map(), outline, shadeTex, render: draw };
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
        latest.current.onDragStart?.(id);
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
      shadeTex.dispose();
      envMap.dispose();
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

    const texFor = (pid: string): THREE.Texture | null => {
      const src = ROOM_PHOTOS[pid];
      if (!src || props.usePhotos === false) return null;
      const cache = textures.current;
      if (!cache.has(src)) {
        cache.set(src, null);
        new THREE.TextureLoader().load(
          src,
          (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 4;
            cache.set(src, t);
            setTick((n) => n + 1);
          },
          undefined,
          () => cache.set(src, null),
        );
      }
      return cache.get(src) ?? null;
    };

    for (const it of items) {
      const product = byId.get(it.pid);
      if (!product) continue;
      seen.add(it.id);
      const tex = texFor(it.pid);
      const want = tex ? "photo" : "model";
      let m = l.models.get(it.id);
      if (m && m.kind !== want) {
        l.scene.remove(m.group);
        disposeModel(m.group);
        l.models.delete(it.id);
        m = undefined;
      }
      const dims = dimsFor(product);
      if (!m) {
        const group = new THREE.Group();
        group.userData.itemId = it.id;
        if (tex) {
          const img = tex.image as { width: number; height: number };
          const size = photoSize(img.width / img.height, dims);
          const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.06, side: THREE.DoubleSide, toneMapped: false });
          const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.w, size.h), mat);
          plane.name = "photo";
          plane.position.y = size.h / 2 + (dims.lift ?? 0);
          group.add(plane);
          // soft contact shadow so the cut-out sits on the floor
          const c = document.createElement("canvas");
          c.width = c.height = 64;
          const g = c.getContext("2d")!;
          const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
          grad.addColorStop(0, "rgba(0,0,0,0.5)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = grad;
          g.fillRect(0, 0, 64, 64);
          const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
          sh.name = "shade";
          sh.rotation.x = -Math.PI / 2;
          sh.position.y = 0.012;
          sh.scale.set(dims.w * 1.05, dims.d * 1.1, 1);
          if (!dims.lift) group.add(sh);
        } else {
          group.add(buildModel(product.art, product.tint, dims));
          // a soft contact shadow so the piece sits on the floor instead of floating on it
          if (!dims.lift && !dims.flat) {
            const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: l.shadeTex, transparent: true, depthWrite: false, opacity: 0.8 }));
            sh.rotation.x = -Math.PI / 2;
            sh.position.y = 0.012;
            sh.scale.set(dims.w * 1.12, dims.d * 1.15, 1);
            group.add(sh);
          }
        }
        l.scene.add(group);
        m = { group, pid: it.pid, kind: want };
        l.models.set(it.id, m);
      }
      m.group.position.set(it.x, 0, it.z);
      if (m.kind === "photo") {
        // The photo always turns to face the camera. Turning the piece mirrors it, and the floor shade follows its footprint.
        m.group.rotation.y = 0;
        const plane = m.group.getObjectByName("photo") as THREE.Mesh;
        const yaw = Math.atan2(cal.position[0] - it.x, cal.position[2] - it.z);
        plane.rotation.y = yaw;
        // In a three-quarter photo the lowest legs are the front ones, so line the photo's bottom up with the front of the footprint.
        const dist = Math.hypot(cal.position[0] - it.x, cal.position[2] - it.z) || 1;
        const front = dimsFor(product).d * 0.3;
        plane.position.x = ((cal.position[0] - it.x) / dist) * front;
        plane.position.z = ((cal.position[2] - it.z) / dist) * front;
        const mirrored = Math.cos(it.rot) < -0.01;
        plane.scale.x = mirrored ? -1 : 1;
        (plane.material as THREE.MeshBasicMaterial).color.setScalar(Math.min(1.1, 0.8 + 0.2 * brightness));
        const shade = m.group.getObjectByName("shade");
        if (shade) shade.rotation.z = -it.rot;
      } else {
        m.group.rotation.y = it.rot;
      }
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
      // An arrow on the front edge shows which way the piece faces.
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), new THREE.MeshBasicMaterial({ color }));
      arrow.rotation.x = Math.PI / 2;
      arrow.scale.y = 0.6;
      arrow.position.set(0, 0.05, d / 2 + 0.5);
      l.outline.add(arrow);
      l.outline.position.set(sel.x, 0, sel.z);
      l.outline.rotation.y = sel.rot;
    }

    l.hemi.intensity = 0.62 * brightness;
    l.scene.environmentIntensity = 0.4 * brightness;
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
