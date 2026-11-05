export const cities = [
  "Noida",
  "Delhi",
  "Gurugram",
  "Ghaziabad",
  "Bengaluru",
  "Mumbai",
  "Pune",
  "Hyderabad",
] as const;

export type City = (typeof cities)[number];

export const tenures = [
  { months: 3, discount: 0, label: "3 months" },
  { months: 6, discount: 0.1, label: "6 months" },
  { months: 12, discount: 0.2, label: "12 months" },
] as const;

export type TenureMonths = (typeof tenures)[number]["months"];

/** Flat fee in INR charged once when you close a rental before the plan ends. */
export const earlyClosureFeeMonths = 1;

export const maintenanceCategories = [
  "Not working",
  "Strange noise",
  "Leak or damage",
  "Cleaning request",
  "Relocation / pickup",
  "Other",
] as const;
