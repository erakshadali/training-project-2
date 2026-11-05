import { describe, expect, it } from "vitest";
import { refundFor, type Claim, type ClaimStatus } from "@/lib/claims";

const claim = (amount: number, status: ClaimStatus): Claim => ({
  id: `CL-${amount}-${status}`,
  rentalId: "RN-1",
  productName: "Study & Work Desk",
  amount,
  note: "Water ring marks",
  status,
  disputeMessage: "",
  resolutionNote: "",
  createdAt: "",
  resolvedAt: null,
});

describe("refundFor", () => {
  it("refunds the whole deposit when there are no claims", () => {
    expect(refundFor(3000, [])).toEqual({ refund: 3000, deducted: 0, onHold: 0 });
  });

  it("deducts charged and upheld claims", () => {
    expect(refundFor(3000, [claim(600, "Charged"), claim(400, "Upheld")])).toEqual({ refund: 2000, deducted: 1000, onHold: 0 });
  });

  it("holds back a disputed amount until it is decided", () => {
    expect(refundFor(3000, [claim(600, "Disputed")])).toEqual({ refund: 2400, deducted: 0, onHold: 600 });
  });

  it("ignores waived claims", () => {
    expect(refundFor(3000, [claim(600, "Waived")])).toEqual({ refund: 3000, deducted: 0, onHold: 0 });
  });

  it("never returns a negative refund", () => {
    expect(refundFor(500, [claim(900, "Upheld")]).refund).toBe(0);
  });
});
