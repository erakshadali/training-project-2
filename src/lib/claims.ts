export type ClaimStatus = "Charged" | "Disputed" | "Upheld" | "Waived";

export type Claim = {
  id: string;
  rentalId: string;
  productName: string;
  amount: number;
  note: string;
  status: ClaimStatus;
  disputeMessage: string;
  resolutionNote: string;
  createdAt: string;
  resolvedAt: string | null;
};

/** Amounts that reduce a deposit refund. Waived claims never do; disputed ones are held back until resolved. */
export function refundFor(depositTotal: number, claims: Claim[]) {
  const deducted = claims.filter((c) => c.status === "Charged" || c.status === "Upheld").reduce((s, c) => s + c.amount, 0);
  const onHold = claims.filter((c) => c.status === "Disputed").reduce((s, c) => s + c.amount, 0);
  return { refund: Math.max(0, depositTotal - deducted - onHold), deducted, onHold };
}

type ClaimLean = {
  claimId: string;
  rentalId: string;
  productName: string;
  amount: number;
  note: string;
  status: ClaimStatus;
  disputeMessage?: string;
  resolutionNote?: string;
  createdAt?: Date;
  resolvedAt?: Date | null;
};

export function serializeClaim(d: ClaimLean): Claim {
  return {
    id: d.claimId,
    rentalId: d.rentalId,
    productName: d.productName,
    amount: d.amount,
    note: d.note,
    status: d.status,
    disputeMessage: d.disputeMessage ?? "",
    resolutionNote: d.resolutionNote ?? "",
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : "",
    resolvedAt: d.resolvedAt ? new Date(d.resolvedAt).toISOString() : null,
  };
}
