import { describe, expect, it } from "vitest";
import { actionsFor, applyAction, canReschedule, legacyTimeline, normalizeStatus, trackSteps, type TimelineEntry } from "@/lib/orderFlow";

const at = (n: number) => `2026-11-0${n}T10:00:00.000Z`;
const entry = (status: TimelineEntry["status"], n: number): TimelineEntry => ({ status, at: at(n), by: "admin", note: "" });

describe("order pipeline transitions", () => {
  it("moves one step at a time, in order", () => {
    expect(applyAction("Placed", "confirm")).toBe("Confirmed");
    expect(applyAction("Confirmed", "pack")).toBe("Packed");
    expect(applyAction("Packed", "dispatch")).toBe("Out for delivery");
    expect(applyAction("Out for delivery", "deliver")).toBe("Delivered");
  });
  it("does not allow skipping a step", () => {
    expect(applyAction("Placed", "pack")).toBeNull();
    expect(applyAction("Placed", "deliver")).toBeNull();
    expect(applyAction("Confirmed", "dispatch")).toBeNull();
    expect(applyAction("Packed", "deliver")).toBeNull();
  });
  it("allows cancelling until the order is delivered", () => {
    for (const s of ["Placed", "Confirmed", "Packed", "Out for delivery"]) expect(applyAction(s, "cancel")).toBe("Cancelled");
    for (const s of ["Delivered", "Closed", "Cancelled"]) expect(applyAction(s, "cancel")).toBeNull();
  });
  it("treats the old Scheduled status as Confirmed", () => {
    expect(normalizeStatus("Scheduled")).toBe("Confirmed");
    expect(applyAction("Scheduled", "pack")).toBe("Packed");
  });
  it("offers the next step first and cancel last", () => {
    expect(actionsFor("Placed")).toEqual(["confirm", "cancel"]);
    expect(actionsFor("Packed")).toEqual(["dispatch", "cancel"]);
    expect(actionsFor("Delivered")).toEqual([]);
  });
  it("lets the date change only before the order leaves", () => {
    expect(canReschedule("Placed")).toBe(true);
    expect(canReschedule("Packed")).toBe(true);
    expect(canReschedule("Out for delivery")).toBe(false);
    expect(canReschedule("Delivered")).toBe(false);
  });
});

describe("order tracker", () => {
  it("marks earlier steps done and the current one current", () => {
    const { steps, cancelled } = trackSteps("Packed", [entry("Placed", 1), entry("Confirmed", 2), entry("Packed", 3)]);
    expect(cancelled).toBe(false);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
    expect(steps[2].at).toBe(at(3));
    expect(steps[3].at).toBeNull();
  });
  it("shows a delivered order as fully done", () => {
    const { steps } = trackSteps("Delivered", [entry("Placed", 1), entry("Confirmed", 1), entry("Packed", 2), entry("Out for delivery", 3), entry("Delivered", 4)]);
    expect(steps.every((s) => s.state === "done")).toBe(true);
  });
  it("shows a closed order as fully done too", () => {
    expect(trackSteps("Closed", legacyTimeline("Closed", at(1), at(5))).steps.every((s) => s.state === "done")).toBe(true);
  });
  it("shows how far a cancelled order got", () => {
    const { steps, cancelled } = trackSteps("Cancelled", [entry("Placed", 1), entry("Confirmed", 2), { status: "Cancelled", at: at(3), by: "admin", note: "Out of stock" }]);
    expect(cancelled).toBe(true);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "upcoming", "upcoming", "upcoming"]);
  });
  it("shows a cancelled order that was never confirmed", () => {
    const { steps } = trackSteps("Cancelled", [entry("Placed", 1), { status: "Cancelled", at: at(2), by: "admin", note: "Not serviceable" }]);
    expect(steps.map((s) => s.state)).toEqual(["done", "upcoming", "upcoming", "upcoming", "upcoming"]);
  });
  it("builds a history for orders that existed before the pipeline", () => {
    expect(legacyTimeline("Scheduled", at(1), at(1)).map((t) => t.status)).toEqual(["Placed", "Confirmed"]);
    expect(legacyTimeline("Delivered", at(1), at(4)).map((t) => t.status)).toEqual(["Placed", "Confirmed", "Delivered"]);
    expect(legacyTimeline("Cancelled", at(1), at(2)).map((t) => t.status)).toEqual(["Placed", "Cancelled"]);
  });
});
