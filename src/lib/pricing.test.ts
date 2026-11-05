import { describe, expect, it } from "vitest";
import { addDays, discountFor, formatDate, inr, lineTotals, monthlyRent, toISODate } from "@/lib/pricing";
import type { Product } from "@/data/products";

const sofa = { id: "p-sofa-3", rent: 899, deposit: 3000 } as Product;
const bed = { id: "p-bed-single", rent: 399, deposit: 1200 } as Product;

describe("monthlyRent", () => {
  it("charges the full price on the 3 month plan", () => {
    expect(monthlyRent(sofa, 3)).toBe(899);
  });

  it("takes 10% off the 6 month plan and 20% off the 12 month plan, rounded to whole rupees", () => {
    expect(monthlyRent(sofa, 6)).toBe(809); // 899 * 0.9 = 809.1
    expect(monthlyRent(sofa, 12)).toBe(719); // 899 * 0.8 = 719.2
    expect(monthlyRent(bed, 12)).toBe(319); // 399 * 0.8 = 319.2
  });

  it("never makes a longer plan cost more per month", () => {
    for (const p of [sofa, bed]) {
      expect(monthlyRent(p, 12)).toBeLessThanOrEqual(monthlyRent(p, 6));
      expect(monthlyRent(p, 6)).toBeLessThanOrEqual(monthlyRent(p, 3));
    }
  });
});

describe("discountFor", () => {
  it("returns the discount for each plan", () => {
    expect(discountFor(3)).toBe(0);
    expect(discountFor(6)).toBe(0.1);
    expect(discountFor(12)).toBe(0.2);
  });

  it("falls back to no discount for an unknown plan", () => {
    expect(discountFor(9 as never)).toBe(0);
  });
});

describe("lineTotals", () => {
  it("multiplies rent and deposit by quantity", () => {
    expect(lineTotals(sofa, { productId: sofa.id, months: 12, qty: 2 })).toEqual({ rent: 1438, deposit: 6000 });
  });
});

describe("inr", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(inr(719)).toBe("₹719");
    expect(inr(100000)).toBe("₹1,00,000");
  });
});

describe("date helpers", () => {
  it("adds days across a month boundary", () => {
    expect(toISODate(addDays(new Date(2026, 10, 29), 3))).toBe("2026-12-02");
  });

  it("formats an ISO date for display", () => {
    expect(formatDate("2026-11-10")).toMatch(/10/);
    expect(formatDate("2026-11-10")).toMatch(/2026/);
  });
});
