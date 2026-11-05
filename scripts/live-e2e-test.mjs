// Full end-to-end test for RentEase against a running site (default: the live deployment).
// Usage:  node scripts/live-e2e-test.mjs [baseUrl]   (run from the project root; reads ADMIN_* and DEMO_* from .env.local)
// It creates a demo customer, bookings, repairs, claims and a hidden test product, and never prints credentials.
// Each run adds another batch of demo data, so run it once per database (or against a throwaway one).
import fs from "node:fs";

const ROOT = process.cwd();
const env = {};
for (const l of fs.readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !l.startsWith("#")) env[m[1]] = m[2].trim();
}
const B = process.argv[2] || "https://rentease-one-khaki.vercel.app";

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, extra = "") => {
  if (ok) pass++; else { fail++; failures.push(name + (extra ? " -> " + extra : "")); }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra && !ok ? "  [" + extra + "]" : ""}`);
};

function jar() {
  let cookie = "";
  return {
    async call(path, method = "GET", body) {
      const res = await fetch(B + path, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
      });
      const sc = res.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0];
      let data = null;
      try { data = await res.json(); } catch { /* html or empty */ }
      return { status: res.status, data };
    },
  };
}

const iso = (d) => d.toLocaleDateString("en-CA");
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const admin = jar(), demo = jar(), anon = jar();
const addr = { name: "Demo Customer", phone: "9811122233", email: "demo.customer@rentease.app", address: "Flat 402, Green Apartments, Sector 62", pincode: "201301" };
const order = (j, city, lines, extra = {}) => j.call("/api/orders", "POST", { ...addr, city, deliveryDate: plus(5), slot: "9 AM to 12 PM", payment: "cod", lines, ...extra });

(async () => {
  console.log(`\n== LIVE TEST against ${B} ==\n`);

  // ---- public pages
  for (const p of ["/", "/products", "/products/three-seater-sofa", "/login", "/register", "/cart", "/checkout"]) {
    const r = await fetch(B + p); check(`GET ${p} is 200`, r.status === 200, String(r.status));
  }
  check("unknown product page is 404", (await fetch(B + "/products/does-not-exist")).status === 404);
  check("/admin redirects logged-out visitors", (await fetch(B + "/admin", { redirect: "manual" })).status === 307);

  // ---- auth
  let r = await admin.call("/api/auth/login", "POST", { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
  check("admin login", r.status === 200 && r.data.user.role === "admin");
  r = await anon.call("/api/auth/login", "POST", { email: env.ADMIN_EMAIL, password: "wrong-password-xyz" });
  check("wrong password refused (401)", r.status === 401);
  r = await anon.call("/api/auth/register", "POST", { name: "A", email: "bad", phone: "1", password: "x" });
  check("register validation (400 with field errors)", r.status === 400 && !!r.data.fields?.email);
  r = await demo.call("/api/auth/register", "POST", { name: "Demo Customer", email: env.DEMO_EMAIL, phone: "9811122233", password: env.DEMO_PASSWORD });
  if (r.status === 409) r = await demo.call("/api/auth/login", "POST", { email: env.DEMO_EMAIL, password: env.DEMO_PASSWORD });
  check("demo customer registered or logged in", r.status === 201 || r.status === 200);
  r = await demo.call("/api/auth/me");
  check("session returns the demo user", r.data.user?.email === env.DEMO_EMAIL);

  // ---- access control
  for (const p of ["stats", "products", "rentals", "users", "areas", "claims", "maintenance"]) {
    check(`admin API ${p}: anon 401, customer 403`, (await anon.call("/api/admin/" + p)).status === 401 && (await demo.call("/api/admin/" + p)).status === 403);
  }

  const before = (await admin.call("/api/admin/products")).data.products;
  const stockOf = (list, id) => list.find((p) => p.id === id).stock;
  const statsBefore = (await admin.call("/api/admin/stats")).data.kpis;

  // ---- booking validation
  r = await order(anon, "Noida", [{ productId: "p-sofa-3", months: 12, qty: 1 }]);
  check("booking without login refused (401)", r.status === 401);
  r = await order(demo, "Noida", [{ productId: "p-sofa-3", months: 12, qty: 1 }], { deliveryDate: "2020-01-01" });
  check("booking with a past date refused (400)", r.status === 400);
  r = await order(demo, "Atlantis", [{ productId: "p-sofa-3", months: 12, qty: 1 }]);
  check("booking to a city we do not serve refused (400)", r.status === 400);
  r = await order(demo, "Noida", [{ productId: "p-sofa-3", months: 12, qty: 1 }], { phone: "123" });
  check("booking with a bad phone refused (400)", r.status === 400);
  r = await order(demo, "Noida", [{ productId: "p-ac", months: 3, qty: 99 }]);
  check("booking quantity above 10 refused (400)", r.status === 400);
  r = await order(demo, "Noida", [{ productId: "p-sofa-3", months: 12, qty: 1, rentPerMonth: 1 }]);
  const tamper = r.data.order;
  check("price tampering ignored: sofa 12 months is 719", r.status === 201 && tamper.lines[0].rentPerMonth === 719, JSON.stringify(tamper?.lines?.[0]));

  // ---- the demo bookings
  const O1 = tamper; // sofa (stays awaiting delivery)
  r = await order(demo, "Noida", [{ productId: "p-tv-43", months: 6, qty: 1 }, { productId: "p-wardrobe", months: 12, qty: 1 }]);
  check("order 2 placed (TV 6 mo + wardrobe 12 mo)", r.status === 201);
  r = await order(demo, "Gurugram", [{ productId: "p-fridge-single", months: 3, qty: 1 }, { productId: "p-washer-front", months: 6, qty: 1 }, { productId: "p-desk", months: 3, qty: 2 }]);
  check("order 3 placed in Gurugram (fridge, washer, 2 desks)", r.status === 201 && r.data.order.city === "Gurugram");
  const O3 = r.data.order;
  r = await order(demo, "Delhi", [{ productId: "p-bed-queen", months: 6, qty: 1 }, { productId: "p-ac", months: 3, qty: 1 }]);
  check("order 4 placed in Delhi (queen bed, AC)", r.status === 201);
  r = await order(demo, "Noida", [{ productId: "p-microwave", months: 3, qty: 1 }]);
  check("order 5 placed (microwave) for the cancel test", r.status === 201);

  const mid = (await admin.call("/api/admin/products")).data.products;
  check("stock decreased for booked items", stockOf(mid, "p-sofa-3") === stockOf(before, "p-sofa-3") - 1 && stockOf(mid, "p-ac") === stockOf(before, "p-ac") - 1);

  r = await demo.call("/api/orders");
  check("my orders lists all 5 bookings", r.status === 200 && r.data.orders.length >= 5, String(r.data.orders?.length));
  r = await demo.call(`/api/orders/${O1.id}`);
  check("order detail readable by its owner", r.status === 200 && r.data.order.id === O1.id);
  r = await anon.call(`/api/orders/${O1.id}`);
  check("order detail not readable when logged out (401)", r.status === 401);

  // ---- rentals
  r = await demo.call("/api/rentals");
  const rentals = r.data.rentals;
  const byPid = (pid, phase) => rentals.find((x) => x.productId === pid && (!phase || x.phase === phase));
  check("rentals created for every ordered item", r.status === 200 && rentals.length >= 9, String(rentals.length));
  check("new rentals are 'Awaiting delivery'", byPid("p-fridge-single").phase === "Awaiting delivery");

  // cancel flow (microwave)
  const mw = byPid("p-microwave");
  r = await demo.call(`/api/rentals/${mw.id}/cancel`, "POST");
  check("cancel before delivery works", r.status === 200 && r.data.rental.phase === "Cancelled");
  r = await demo.call(`/api/rentals/${mw.id}/cancel`, "POST");
  check("cancel twice refused (409)", r.status === 409);
  const afterCancel = (await admin.call("/api/admin/products")).data.products;
  check("cancel put the microwave back in stock", stockOf(afterCancel, "p-microwave") === stockOf(before, "p-microwave"));

  // admin delivers
  const toDeliver = ["p-fridge-single", "p-washer-front", "p-desk", "p-bed-queen", "p-ac", "p-wardrobe"];
  const ids = {};
  for (const pid of toDeliver) {
    const rn = rentals.find((x) => x.productId === pid && x.phase === "Awaiting delivery");
    ids[pid] = rn.id;
    r = await admin.call(`/api/admin/rentals/${rn.id}/deliver`, "POST");
    check(`admin marks ${pid} delivered`, r.status === 200 && r.data.rental.phase === "Active");
  }
  check("customer cannot mark delivered (403)", (await demo.call(`/api/admin/rentals/${ids["p-ac"]}/deliver`, "POST")).status === 403);
  check("mark delivered twice refused (409)", (await admin.call(`/api/admin/rentals/${ids["p-ac"]}/deliver`, "POST")).status === 409);

  // repairs
  r = await demo.call("/api/maintenance", "POST", { rentalId: ids["p-fridge-single"], category: "Not working", description: "The fridge is not cooling and makes a buzzing sound" });
  check("repair request raised on a delivered item", r.status === 201);
  const mr1 = r.data.request.id;
  r = await demo.call("/api/maintenance", "POST", { rentalId: ids["p-ac"], category: "Strange noise", description: "The AC rattles loudly when the compressor starts" });
  const mr2 = r.data.request.id;
  check("second repair request raised", r.status === 201);
  r = await demo.call("/api/maintenance", "POST", { rentalId: byPid("p-sofa-3").id, category: "Other", description: "Trying a repair before delivery" });
  check("repair on an undelivered item refused (409)", r.status === 409);
  r = await demo.call("/api/maintenance", "POST", { rentalId: ids["p-ac"], category: "Not working", description: "short" });
  check("repair with a short description refused (400)", r.status === 400);
  r = await admin.call(`/api/admin/maintenance/${mr1}`, "PATCH", { status: "In progress", note: "Technician visiting tomorrow between 11 AM and 1 PM" });
  check("admin sets repair In progress with a note", r.status === 200 && r.data.request.status === "In progress");
  r = await admin.call(`/api/admin/maintenance/${mr2}`, "PATCH", { status: "Resolved", note: "Compressor mount tightened, noise gone" });
  check("admin resolves a repair (resolvedAt set)", r.status === 200 && !!r.data.request.resolvedAt);
  r = await demo.call("/api/maintenance");
  check("customer sees admin notes on repairs", r.data.requests.some((x) => x.note.includes("Technician")));

  // extend
  r = await demo.call(`/api/rentals/${ids["p-ac"]}/extend`, "POST", { addMonths: 3 });
  check("extend AC +3 months: tier 6 price (1169)", r.status === 200 && r.data.rental.months === 6 && r.data.rental.rentPerMonth === 1169, JSON.stringify(r.data.rental && { m: r.data.rental.months, r: r.data.rental.rentPerMonth }));
  r = await demo.call(`/api/rentals/${ids["p-ac"]}/extend`, "POST", { addMonths: 5 });
  check("extend by 5 months refused (400)", r.status === 400);
  r = await demo.call(`/api/rentals/${byPid("p-sofa-3").id}/extend`, "POST", { addMonths: 3 });
  check("extend before delivery refused (409)", r.status === 409);

  // pickups
  r = await demo.call(`/api/rentals/${ids["p-washer-front"]}/return`, "POST", { date: plus(2), slot: "3 PM to 6 PM" });
  check("pickup booked with early-closure fee", r.status === 200 && r.data.rental.returnRequest.earlyClosureFee === r.data.rental.rentPerMonth * r.data.rental.qty, JSON.stringify(r.data.rental?.returnRequest));
  r = await demo.call(`/api/rentals/${ids["p-wardrobe"]}/return`, "POST", { date: plus(3), slot: "9 AM to 12 PM" });
  check("pickup booked for the wardrobe", r.status === 200);
  r = await demo.call(`/api/rentals/${ids["p-wardrobe"]}/return`, "DELETE");
  check("pickup cancelled, rental active again", r.status === 200 && r.data.rental.phase === "Active");
  r = await demo.call(`/api/rentals/${ids["p-wardrobe"]}/return`, "POST", { date: "2020-01-01", slot: "9 AM to 12 PM" });
  check("pickup in the past refused (400)", r.status === 400);

  // returns, damage claims, disputes
  const stockBeforeReturn = stockOf((await admin.call("/api/admin/products")).data.products, "p-bed-queen");
  r = await admin.call(`/api/admin/rentals/${ids["p-bed-queen"]}/return`, "POST", {});
  check("admin returns the queen bed (no damage)", r.status === 200 && r.data.rental.phase === "Returned" && !r.data.claimId);
  check("return restored stock", stockOf((await admin.call("/api/admin/products")).data.products, "p-bed-queen") === stockBeforeReturn + 1);
  check("return twice refused (409)", (await admin.call(`/api/admin/rentals/${ids["p-bed-queen"]}/return`, "POST", {})).status === 409);

  r = await admin.call(`/api/admin/rentals/${ids["p-desk"]}/return`, "POST", { damageCharge: 999999, damageNote: "Far too much" });
  check("damage above the deposit refused (400)", r.status === 400);
  r = await admin.call(`/api/admin/rentals/${ids["p-desk"]}/return`, "POST", { damageCharge: 400, damageNote: "Water ring marks on the desk top" });
  check("admin returns desks with a 400 damage charge", r.status === 200 && !!r.data.claimId);
  const cl = r.data.claimId;
  r = await demo.call("/api/claims");
  check("customer sees the damage claim", r.data.claims.some((c) => c.id === cl && c.status === "Charged" && c.amount === 400));
  r = await demo.call(`/api/claims/${cl}/dispute`, "POST", { message: "no" });
  check("dispute with a short message refused (400)", r.status === 400);
  r = await demo.call(`/api/claims/${cl}/dispute`, "POST", { message: "Those marks were already on the desk when it was delivered." });
  check("customer disputes the charge", r.status === 200 && r.data.claim.status === "Disputed");
  check("dispute twice refused (409)", (await demo.call(`/api/claims/${cl}/dispute`, "POST", { message: "Those marks were already on the desk." })).status === 409);
  r = await admin.call(`/api/admin/claims/${cl}`, "PATCH", { decision: "Waived", note: "Delivery photos show the marks were already there" });
  check("admin waives the claim", r.status === 200 && r.data.claim.status === "Waived");
  check("settle twice refused (409)", (await admin.call(`/api/admin/claims/${cl}`, "PATCH", { decision: "Upheld", note: "Changed my mind" })).status === 409);

  // ---- admin: schedule, claims, repairs lists
  r = await admin.call("/api/admin/rentals");
  check("admin schedule lists rentals with customer and address", r.status === 200 && r.data.rentals.some((x) => x.customer?.name === "Demo Customer" && x.address.includes("Sector 62")));
  check("admin sees the pickup booked", r.data.rentals.some((x) => x.phase === "Return scheduled"));
  r = await admin.call("/api/admin/maintenance");
  check("admin repairs queue has the open request", r.data.requests.some((x) => x.id === mr1 && x.status === "In progress"));
  r = await admin.call("/api/admin/claims");
  check("admin claims list has the waived claim", r.data.claims.some((x) => x.id === cl && x.status === "Waived"));

  // ---- admin: inventory (add, edit, hide)
  r = await admin.call("/api/admin/products", "POST", { name: "Live Test Beanbag", category: "furniture", subcategory: "Chairs", art: "chair", tint: "#aa5533", blurb: "A soft beanbag for reading corners.", description: "A very soft beanbag chair that is great for reading corners and gaming.", rent: 199, deposit: 600, stock: 4, popular: false });
  check("admin adds a product", r.status === 201);
  const np = r.data.product;
  check("new product visible in the shop", (await fetch(`${B}/products/${np.slug}`)).status === 200);
  r = await admin.call("/api/admin/products", "POST", { name: "x" });
  check("add product validation (400)", r.status === 400);
  r = await admin.call(`/api/admin/products/${np.id}`, "PATCH", { rent: 249, stock: 6 });
  check("admin edits rent and stock", r.status === 200 && r.data.product.rent === 249 && r.data.product.stock === 6);
  check("edit validation (400)", (await admin.call(`/api/admin/products/${np.id}`, "PATCH", { rent: -1 })).status === 400);
  check("customer cannot edit products (403)", (await demo.call(`/api/admin/products/${np.id}`, "PATCH", { rent: 1 })).status === 403);
  r = await admin.call(`/api/admin/products/${np.id}`, "DELETE");
  check("admin hides the test product", r.status === 200);
  check("hidden product gone from the shop (404)", (await fetch(`${B}/products/${np.slug}`)).status === 404);

  // ---- admin: service areas
  r = await admin.call("/api/admin/areas", "POST", { name: "Jaipur" });
  const jaipur = r.data.area;
  check("admin adds a city", r.status === 201 || r.status === 409);
  check("duplicate city refused (409)", (await admin.call("/api/admin/areas", "POST", { name: "jaipur" })).status === 409);
  if (r.status === 409) { const list = (await admin.call("/api/admin/areas")).data.areas; Object.assign(jaipur ?? {}, list.find((a) => a.name === "Jaipur")); }
  const ar = (await admin.call("/api/admin/areas")).data.areas.find((a) => a.name === "Jaipur");
  if (!ar.active) await admin.call(`/api/admin/areas/${ar.id}`, "PATCH", { active: true }); // re-runs: switch it back on first
  r = await order(demo, "Jaipur", [{ productId: "p-chair", months: 3, qty: 1 }]);
  check("new city accepted at checkout", r.status === 201);
  if (r.status === 201) {
    const chairRental = (await demo.call("/api/rentals")).data.rentals.find((x) => x.orderId === r.data.order.id);
    await demo.call(`/api/rentals/${chairRental.id}/cancel`, "POST");
  }
  r = await admin.call(`/api/admin/areas/${ar.id}`, "PATCH", { active: false });
  check("admin switches the city off", r.status === 200 && r.data.area.active === false);
  r = await order(demo, "Jaipur", [{ productId: "p-chair", months: 3, qty: 1 }]);
  check("switched-off city refused at checkout (400)", r.status === 400);

  // ---- admin: users
  const users = (await admin.call("/api/admin/users")).data.users;
  const du = users.find((u) => u.email === env.DEMO_EMAIL);
  check("admin sees the demo customer with order counts", !!du && du.orders >= 6);
  r = await admin.call(`/api/admin/users/${du.id}`, "PATCH", { disabled: true });
  check("admin suspends the demo customer", r.status === 200);
  check("suspended customer's session stops working", (await demo.call("/api/auth/me")).data.user === null);
  check("suspended customer cannot log in (403)", (await anon.call("/api/auth/login", "POST", { email: env.DEMO_EMAIL, password: env.DEMO_PASSWORD })).status === 403);
  r = await admin.call(`/api/admin/users/${du.id}`, "PATCH", { disabled: false });
  check("admin restores the customer", r.status === 200);
  r = await demo.call("/api/auth/login", "POST", { email: env.DEMO_EMAIL, password: env.DEMO_PASSWORD });
  check("restored customer can log in again", r.status === 200);
  const adm = users.find((u) => u.role === "admin");
  check("admin account cannot be suspended (409)", (await admin.call(`/api/admin/users/${adm.id}`, "PATCH", { disabled: true })).status === 409);

  // ---- stats
  const s = (await admin.call("/api/admin/stats")).data;
  check("stats: active rentals, MRR, deposits, orders updated", s.kpis.activeRentals >= 3 && s.kpis.mrr > 0 && s.kpis.depositHeld > 0 && s.kpis.totalOrders >= statsBefore.totalOrders + 5, JSON.stringify(s.kpis));
  check("stats: deliveries due includes the sofa and TV", s.kpis.deliveriesDue >= 2);
  check("stats: pickups due includes the washer", s.kpis.pickupsDue >= 1);
  check("stats: repair resolution time computed", s.kpis.resolvedRepairs >= 1 && s.kpis.avgResolutionHours !== null);
  console.log("\nKPIs now:", JSON.stringify({ active: s.kpis.activeRentals, awaiting: s.kpis.awaitingDelivery, mrr: s.kpis.mrr, deposits: s.kpis.depositHeld, orders: s.kpis.totalOrders, openRepairs: s.kpis.openRepairs, deliveriesDue: s.kpis.deliveriesDue, pickupsDue: s.kpis.pickupsDue }));

  console.log(`\n== ${pass} passed, ${fail} failed ==`);
  if (fail) { console.log("FAILURES:"); failures.forEach((f) => console.log(" -", f)); process.exit(1); }
})().catch((e) => { console.log("TEST CRASHED:", e.message); process.exit(2); });
