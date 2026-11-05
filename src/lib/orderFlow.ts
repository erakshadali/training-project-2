/**
 * The order pipeline: Placed, Confirmed, Packed, Out for delivery, Delivered.
 * An order can also be Cancelled (rejected by the admin or cancelled before delivery) or Closed once every item is back.
 *
 * Everything here is pure, so it is unit tested and shared by the API routes and the screens.
 */

export const PIPELINE = ["Placed", "Confirmed", "Packed", "Out for delivery", "Delivered"] as const;
export type PipelineStage = (typeof PIPELINE)[number];
export type OrderStatus = PipelineStage | "Closed" | "Cancelled";

/** Orders saved before the pipeline existed used "Scheduled". That meant confirmed and waiting for delivery. */
export function normalizeStatus(s: string): OrderStatus {
  return s === "Scheduled" ? "Confirmed" : (s as OrderStatus);
}

export type OrderAction = "confirm" | "pack" | "dispatch" | "deliver" | "cancel";

const transitions: Record<string, Partial<Record<OrderAction, OrderStatus>>> = {
  Placed: { confirm: "Confirmed", cancel: "Cancelled" },
  Confirmed: { pack: "Packed", cancel: "Cancelled" },
  Packed: { dispatch: "Out for delivery", cancel: "Cancelled" },
  "Out for delivery": { deliver: "Delivered", cancel: "Cancelled" },
};

/** The status an action leads to, or null when the action is not allowed from the current status. */
export function applyAction(status: string, action: OrderAction): OrderStatus | null {
  return transitions[normalizeStatus(status)]?.[action] ?? null;
}

export const actionLabels: Record<OrderAction, string> = {
  confirm: "Confirm order",
  pack: "Mark as packed",
  dispatch: "Send out for delivery",
  deliver: "Mark as delivered",
  cancel: "Reject or cancel",
};

/** Actions the admin can take next, with the main step first and cancel last. */
export function actionsFor(status: string): OrderAction[] {
  const t = transitions[normalizeStatus(status)];
  if (!t) return [];
  const order: OrderAction[] = ["confirm", "pack", "dispatch", "deliver", "cancel"];
  return order.filter((a) => t[a]);
}

/** The delivery date and slot can be changed until the order leaves for delivery. */
export function canReschedule(status: string) {
  const s = normalizeStatus(status);
  return s === "Placed" || s === "Confirmed" || s === "Packed";
}

export type TimelineEntry = { status: OrderStatus; at: string; by: "customer" | "admin" | "system"; note: string };

export type TrackStep = { stage: PipelineStage; state: "done" | "current" | "upcoming"; at: string | null };

/** The five steps shown on the order tracker, with the time each was reached. */
export function trackSteps(status: string, timeline: TimelineEntry[]): { steps: TrackStep[]; cancelled: boolean } {
  const s = normalizeStatus(status);
  const cancelled = s === "Cancelled";
  const reachedStatuses = new Set(timeline.map((t) => t.status));
  // Where the order got to: for a cancelled order, the furthest stage it reached before being cancelled.
  let reached = -1;
  PIPELINE.forEach((p, i) => {
    if (cancelled ? reachedStatuses.has(p) : p === s || (s === "Closed" && p === "Delivered")) reached = Math.max(reached, i);
  });
  if (!cancelled && reached < 0) reached = 0;
  const atFor = (p: PipelineStage) => [...timeline].reverse().find((t) => t.status === p)?.at ?? null;
  const steps = PIPELINE.map((stage, i): TrackStep => {
    const done = i < reached || (i === reached && (cancelled || stage === "Delivered"));
    return { stage, state: done ? "done" : i === reached ? "current" : "upcoming", at: i <= reached ? atFor(stage) : null };
  });
  return { steps, cancelled };
}

/** Timeline for orders created before the pipeline, so old orders still show a sensible history. */
export function legacyTimeline(status: string, createdAt: string, updatedAt: string): TimelineEntry[] {
  const s = normalizeStatus(status);
  const out: TimelineEntry[] = [{ status: "Placed", at: createdAt, by: "system", note: "" }];
  if (s === "Cancelled") return [...out, { status: "Cancelled", at: updatedAt, by: "system", note: "" }];
  out.push({ status: "Confirmed", at: createdAt, by: "system", note: "Confirmed automatically" });
  if (s === "Delivered" || s === "Closed") out.push({ status: "Delivered", at: updatedAt, by: "system", note: "" });
  if (s === "Closed") out.push({ status: "Closed", at: updatedAt, by: "system", note: "" });
  return out;
}
