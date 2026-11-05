"use client";

import { LazyMotion } from "framer-motion";

// The animation features load in a separate chunk after the page is interactive,
// so they stay off the critical rendering path.
const loadFeatures = () => import("@/components/motionFeatures").then((mod) => mod.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
