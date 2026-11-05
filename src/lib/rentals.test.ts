import { describe, expect, it } from "vitest";
import { addDaysISO, addMonthsISO, daysBetween, earlyClosureFee, phaseOf, progressOf, tierFor } from "@/lib/rentals";

describe("addMonthsISO", () => {
  it("moves a date forward by whole months", () => {
    expect(addMonthsISO("2026-11-05", 3)).toBe("2027-02-05");
    expect(addMonthsISO("2026-11-05", 12)).toBe("2027-11-05");
  });

  it("clamps to the last day of a shorter month instead of overflowing", () => {
    expect(addMonthsISO("2026-12-31", 2)).toBe("2027-02-28");
    expect(addMonthsISO("2027-12-31", 2)).toBe("2028-02-29"); // 2028 is a leap year
    expect(addMonthsISO("2026-08-31", 1)).toBe("2026-09-30");
  });
});

describe("addDaysISO and daysBetween", () => {
  it("round-trips", () => {
    expect(addDaysISO("2026-11-29", 3)).toBe("2026-12-02");
    expect(daysBetween("2026-11-05", "2026-11-10")).toBe(5);
    expect(daysBetween("2026-11-10", "2026-11-05")).toBe(-5);
  });
});

describe("tierFor", () => {
  it("picks the price tier for the total plan length", () => {
    expect(tierFor(3)).toBe(3);
    expect(tierFor(5)).toBe(3);
    expect(tierFor(6)).toBe(6);
    expect(tierFor(11)).toBe(6);
    expect(tierFor(12)).toBe(12);
    expect(tierFor(24)).toBe(12);
  });

  it("makes a 3 month plan extended by 3 months a 6 month plan", () => {
    expect(tierFor(3 + 3)).toBe(6);
  });
});

describe("phaseOf", () => {
  const rental = { startDate: "2026-11-10", endDate: "2027-02-10" };

  it("is awaiting delivery before the start date", () => {
    expect(phaseOf({ ...rental, status: "Scheduled" }, "2026-11-09")).toBe("Awaiting delivery");
  });

  it("is active from the start date through the end date", () => {
    expect(phaseOf({ ...rental, status: "Scheduled" }, "2026-11-10")).toBe("Active");
    expect(phaseOf({ ...rental, status: "Scheduled" }, "2027-02-10")).toBe("Active");
  });

  it("is plan ended the day after the end date", () => {
    expect(phaseOf({ ...rental, status: "Scheduled" }, "2027-02-11")).toBe("Plan ended");
  });

  it("lets the stored status win once a pickup, return or cancellation happens", () => {
    expect(phaseOf({ ...rental, status: "Return scheduled" }, "2026-11-20")).toBe("Return scheduled");
    expect(phaseOf({ ...rental, status: "Returned" }, "2026-11-20")).toBe("Returned");
    expect(phaseOf({ ...rental, status: "Cancelled" }, "2026-11-01")).toBe("Cancelled");
  });
});

describe("progressOf", () => {
  const r = { startDate: "2026-11-01", endDate: "2026-11-11" };

  it("is 0 before the start, 1 after the end, and proportional in between", () => {
    expect(progressOf(r, "2026-10-25")).toBe(0);
    expect(progressOf(r, "2026-11-06")).toBe(0.5);
    expect(progressOf(r, "2026-12-01")).toBe(1);
  });
});

describe("earlyClosureFee", () => {
  const r = { endDate: "2027-02-10", rentPerMonth: 1039, qty: 2 };

  it("charges one month of rent for every unit when the pickup is before the plan ends", () => {
    expect(earlyClosureFee(r, "2026-12-01")).toBe(2078);
  });

  it("is free on or after the end date", () => {
    expect(earlyClosureFee(r, "2027-02-10")).toBe(0);
    expect(earlyClosureFee(r, "2027-03-01")).toBe(0);
  });
});
