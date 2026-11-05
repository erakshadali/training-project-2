export type Category = "furniture" | "appliances";

export type ArtKind =
  | "bed"
  | "sofa"
  | "dining"
  | "desk"
  | "wardrobe"
  | "chair"
  | "shelf"
  | "fridge"
  | "washer"
  | "tv"
  | "ac"
  | "microwave"
  | "purifier";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  subcategory: string;
  art: ArtKind;
  tint: string;
  blurb: string;
  description: string;
  /** monthly rent in INR on the 3 month plan */
  rent: number;
  /** refundable security deposit in INR */
  deposit: number;
  features: string[];
  specs: Record<string, string>;
  popular?: boolean;
  stock: number;
};

export const products: Product[] = [
  {
    id: "p-bed-queen",
    slug: "queen-bed-with-storage",
    name: "Queen Bed with Storage",
    category: "furniture",
    subcategory: "Beds",
    art: "bed",
    tint: "#b9855a",
    blurb: "Engineered-wood queen bed with a lift-up storage base.",
    description:
      "A sturdy queen bed with a hydraulic lift-up base so suitcases, quilts and winter clothes stay out of sight. The mattress is sold separately on its own rental plan.",
    rent: 749,
    deposit: 2500,
    features: ["Hydraulic storage base", "Scratch-resistant finish", "Assembled at your door", "Free relocation support"],
    specs: { Size: "Queen (78 x 60 in)", Material: "Engineered wood", Storage: "Full base", Warranty: "Covered for the whole rental" },
    popular: true,
    stock: 24,
  },
  {
    id: "p-bed-single",
    slug: "single-bed-frame",
    name: "Single Bed Frame",
    category: "furniture",
    subcategory: "Beds",
    art: "bed",
    tint: "#8f6b4b",
    blurb: "Compact single bed that fits hostel rooms and studios.",
    description:
      "A slim single bed made for small rooms. Light enough to move between flats and strong enough for daily use.",
    rent: 399,
    deposit: 1200,
    features: ["Space-saving design", "Solid slat base", "Quick assembly", "Easy to move"],
    specs: { Size: "Single (75 x 36 in)", Material: "Engineered wood", Weight: "28 kg" },
    stock: 40,
  },
  {
    id: "p-sofa-3",
    slug: "three-seater-sofa",
    name: "3-Seater Fabric Sofa",
    category: "furniture",
    subcategory: "Sofas",
    art: "sofa",
    tint: "#2f6f62",
    blurb: "Deep, soft three-seater in a stain-resistant weave.",
    description:
      "A comfortable three-seater with high-density foam cushions and a washable-look fabric that hides everyday marks.",
    rent: 899,
    deposit: 3000,
    features: ["High-density foam", "Stain-resistant fabric", "Solid wood legs", "Professional deep clean at return"],
    specs: { Seats: "3", Width: "84 in", Fabric: "Woven polyester", Frame: "Seasoned wood" },
    popular: true,
    stock: 18,
  },
  {
    id: "p-sofa-2",
    slug: "two-seater-loveseat",
    name: "2-Seater Loveseat",
    category: "furniture",
    subcategory: "Sofas",
    art: "sofa",
    tint: "#c9704f",
    blurb: "A small sofa that makes a studio feel like a home.",
    description: "Two comfortable seats in a footprint that works for balconies, bedrooms and small living rooms.",
    rent: 649,
    deposit: 2000,
    features: ["Compact footprint", "Soft-touch fabric", "Tapered wooden legs", "Free delivery"],
    specs: { Seats: "2", Width: "58 in", Fabric: "Woven polyester" },
    stock: 22,
  },
  {
    id: "p-dining-4",
    slug: "four-seater-dining-set",
    name: "4-Seater Dining Set",
    category: "furniture",
    subcategory: "Tables",
    art: "dining",
    tint: "#a97c50",
    blurb: "A round table with four cushioned chairs.",
    description: "A dining table and four chairs in one monthly plan. Easy to wipe, easy to move, good for family meals and work-from-home days.",
    rent: 849,
    deposit: 2800,
    features: ["Table plus 4 chairs", "Wipe-clean top", "Cushioned seats", "One plan, one delivery"],
    specs: { Seats: "4", Top: "Laminated engineered wood", Shape: "Round" },
    popular: true,
    stock: 15,
  },
  {
    id: "p-desk",
    slug: "study-and-work-desk",
    name: "Study & Work Desk",
    category: "furniture",
    subcategory: "Tables",
    art: "desk",
    tint: "#7a5a3c",
    blurb: "A roomy desk with a drawer and cable cut-out.",
    description: "A calm, clutter-free desk for studying or working from home, with a deep drawer and a cable pass-through.",
    rent: 449,
    deposit: 1500,
    features: ["Cable management hole", "Soft-close drawer", "Spacious top", "Fits two monitors"],
    specs: { Width: "48 in", Depth: "24 in", Drawers: "1" },
    stock: 35,
  },
  {
    id: "p-wardrobe",
    slug: "two-door-wardrobe",
    name: "2-Door Wardrobe",
    category: "furniture",
    subcategory: "Storage",
    art: "wardrobe",
    tint: "#6c7f77",
    blurb: "Hanging space, shelves and a lockable drawer.",
    description: "A tall two-door wardrobe with a hanging rail, three shelves and a lockable drawer for documents and valuables.",
    rent: 599,
    deposit: 2000,
    features: ["Lockable drawer", "Hanging rail", "3 shelves", "Anti-tip wall anchor"],
    specs: { Height: "72 in", Width: "36 in", Doors: "2" },
    stock: 20,
  },
  {
    id: "p-chair",
    slug: "ergonomic-office-chair",
    name: "Ergonomic Office Chair",
    category: "furniture",
    subcategory: "Chairs",
    art: "chair",
    tint: "#33413d",
    blurb: "Mesh back, adjustable height, lumbar support.",
    description: "A breathable mesh chair with adjustable height and lumbar support, built for long working days.",
    rent: 299,
    deposit: 1000,
    features: ["Mesh back", "Lumbar support", "Height adjustment", "Smooth caster wheels"],
    specs: { Back: "Mesh", Arms: "Fixed", Base: "Nylon" },
    stock: 50,
  },
  {
    id: "p-shelf",
    slug: "five-tier-bookshelf",
    name: "5-Tier Bookshelf",
    category: "furniture",
    subcategory: "Storage",
    art: "shelf",
    tint: "#b08a62",
    blurb: "Open shelves for books, plants and keepsakes.",
    description: "A tall, light bookshelf that keeps books, plants and small decor within reach.",
    rent: 249,
    deposit: 800,
    features: ["5 open shelves", "Wall-anchor kit", "Light and easy to move", "Rounded edges"],
    specs: { Height: "70 in", Width: "30 in", Shelves: "5" },
    stock: 30,
  },
  {
    id: "p-fridge-single",
    slug: "single-door-refrigerator",
    name: "Single Door Refrigerator 190L",
    category: "appliances",
    subcategory: "Refrigerators",
    art: "fridge",
    tint: "#9fb7c4",
    blurb: "Direct-cool 190 litre fridge for one or two people.",
    description: "An energy-efficient single door fridge with a freezer compartment. Free installation and free repairs for the whole rental.",
    rent: 599,
    deposit: 2000,
    features: ["Direct cool", "Free installation", "Free repair visits", "Energy efficient"],
    specs: { Capacity: "190 L", Type: "Single door", Rating: "3 star" },
    popular: true,
    stock: 26,
  },
  {
    id: "p-fridge-double",
    slug: "double-door-refrigerator",
    name: "Double Door Refrigerator 260L",
    category: "appliances",
    subcategory: "Refrigerators",
    art: "fridge",
    tint: "#c4ccd2",
    blurb: "Frost-free 260 litre fridge for families.",
    description: "A frost-free double door fridge with a big freezer and a vegetable crisper. Installed free and serviced free.",
    rent: 899,
    deposit: 3500,
    features: ["Frost free", "Large freezer", "Vegetable crisper", "Free installation"],
    specs: { Capacity: "260 L", Type: "Double door", Rating: "3 star" },
    stock: 14,
  },
  {
    id: "p-washer-front",
    slug: "front-load-washing-machine",
    name: "Front Load Washing Machine 7kg",
    category: "appliances",
    subcategory: "Washing machines",
    art: "washer",
    tint: "#d6dde2",
    blurb: "Fully automatic 7 kg front loader with quick wash.",
    description: "A gentle, water-saving front loader with a 15 minute quick wash. We install it and we fix it if anything goes wrong.",
    rent: 799,
    deposit: 3000,
    features: ["Quick 15 min wash", "Water saving", "Free installation", "Free repair visits"],
    specs: { Capacity: "7 kg", Type: "Front load", Spin: "1200 rpm" },
    popular: true,
    stock: 16,
  },
  {
    id: "p-washer-top",
    slug: "top-load-washing-machine",
    name: "Top Load Washing Machine 6.5kg",
    category: "appliances",
    subcategory: "Washing machines",
    art: "washer",
    tint: "#b6c5cf",
    blurb: "Simple, strong 6.5 kg top loader.",
    description: "A fully automatic top loader that is easy to use and easy to live with. Installed free, serviced free.",
    rent: 599,
    deposit: 2200,
    features: ["Fully automatic", "Easy top loading", "Free installation", "Free repair visits"],
    specs: { Capacity: "6.5 kg", Type: "Top load", Spin: "740 rpm" },
    stock: 20,
  },
  {
    id: "p-tv-43",
    slug: "smart-led-tv-43",
    name: "43 inch Smart LED TV",
    category: "appliances",
    subcategory: "Televisions",
    art: "tv",
    tint: "#222c2a",
    blurb: "Full HD smart TV with apps built in.",
    description: "A 43 inch Full HD smart TV with streaming apps built in. Wall mounting is available at delivery.",
    rent: 699,
    deposit: 2500,
    features: ["Full HD", "Smart apps", "Wall mount available", "Free installation"],
    specs: { Size: "43 in", Resolution: "1920 x 1080", Smart: "Yes" },
    stock: 18,
  },
  {
    id: "p-ac",
    slug: "split-ac-1-5-ton",
    name: "1.5 Ton Split AC",
    category: "appliances",
    subcategory: "Air conditioners",
    art: "ac",
    tint: "#e9eef0",
    blurb: "Inverter split AC with copper condenser.",
    description: "A 1.5 ton inverter split AC for rooms up to 180 sq ft. Installation, de-installation and servicing are included.",
    rent: 1299,
    deposit: 5000,
    features: ["Inverter compressor", "Copper condenser", "Installation included", "Free seasonal service"],
    specs: { Capacity: "1.5 ton", Type: "Split inverter", Room: "Up to 180 sq ft" },
    popular: true,
    stock: 12,
  },
  {
    id: "p-microwave",
    slug: "convection-microwave-oven",
    name: "Convection Microwave 23L",
    category: "appliances",
    subcategory: "Kitchen",
    art: "microwave",
    tint: "#4b5755",
    blurb: "Grill, bake and reheat in one 23 litre oven.",
    description: "A convection microwave for baking, grilling and reheating, with auto-cook menus that make weekday dinners easier.",
    rent: 349,
    deposit: 1200,
    features: ["Convection and grill", "Auto-cook menus", "Child lock", "Free delivery"],
    specs: { Capacity: "23 L", Type: "Convection", Power: "1200 W" },
    stock: 25,
  },
  {
    id: "p-purifier",
    slug: "ro-water-purifier",
    name: "RO Water Purifier 8L",
    category: "appliances",
    subcategory: "Kitchen",
    art: "purifier",
    tint: "#5aa3b8",
    blurb: "RO plus UV purification with filter changes included.",
    description: "An 8 litre RO and UV purifier. Filter changes and servicing are part of your rent, so you never have to think about them.",
    rent: 399,
    deposit: 1500,
    features: ["RO plus UV", "Filter changes included", "Free installation", "Quarterly service"],
    specs: { Tank: "8 L", Purification: "RO + UV", Service: "Quarterly" },
    stock: 28,
  },
];

export const categories: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "furniture", label: "Furniture" },
  { id: "appliances", label: "Appliances" },
];

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function getProductById(id: string) {
  return products.find((p) => p.id === id);
}
