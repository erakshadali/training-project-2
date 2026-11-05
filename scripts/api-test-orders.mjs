// End-to-end test of the order pipeline against a running RentEase server.
// Usage:  node scripts/api-test-orders.mjs [baseUrl]    (default http://localhost:3500, run from the project root)
// Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env.local and never prints them. It creates throwaway customers and orders,
// so point it at a local server or a disposable database, not at production data you care about.
import fs from "node:fs";

const env = {};
for (const l of fs.readFileSync(`${process.cwd()}/.env.local`, "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !l.startsWith("#")) env[m[1]] = process.env[m[1]] ?? m[2].trim();
}
const B = process.argv[2] || "http://localhost:3500";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra ? "  [" + extra + "]" : ""}`);
};

function jar() {
  let cookie = "";
  return {
    async call(path, method = "GET", body) {
      const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
      const sc = res.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0];
      let data = null;
      try { data = await res.json(); } catch { /* empty */ }
      return { status: res.status, data };
    },
  };
}
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const stamp = Date.now();
const admin = jar(), cust = jar(), other = jar(), anon = jar();
const addr = { name: "Pipeline Tester", phone: "9811122233", address: "Flat 402, Green Apartments, Sector 62", pincode: "201301", city: "Noida" };
const place = (j, lines, extra = {}) => j.call("/api/orders", "POST", { ...addr, email: `pipeline.${stamp}@example.com`, deliveryDate: plus(5), slot: "9 AM to 12 PM", payment: "cod", lines, ...extra });
const act = (id, body) => admin.call(`/api/admin/orders/${id}`, "POST", body);
const stock = async (id) => (await admin.call("/api/admin/products")).data.products.find((p) => p.id === id).stock;
const myOrder = async (id) => (await cust.call(`/api/orders/${id}`)).data.order;
const myRentals = async (orderId) => (await cust.call("/api/rentals")).data.rentals.filter((r) => r.orderId === orderId);
const statuses = (o) => o.timeline.map((t) => t.status).join(">");

(async () => {
  console.log(`\n== ORDER PIPELINE TEST against ${B} ==\n`);

  let r = await admin.call("/api/auth/login", "POST", { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
  check("admin login", r.status === 200 && r.data.user.role === "admin");
  r = await cust.call("/api/auth/register", "POST", { name: "Pipeline Tester", email: `pipeline.${stamp}@example.com`, phone: "9811122233", password: "Tester#12345" });
  check("customer registered", r.status === 201);
  r = await other.call("/api/auth/register", "POST", { name: "Someone Else", email: `other.${stamp}@example.com`, phone: "9811100000", password: "Tester#12345" });
  check("second customer registered", r.status === 201);

  // ---- access control
  check("orders list: anon 401, customer 403", (await anon.call("/api/admin/orders")).status === 401 && (await cust.call("/api/admin/orders")).status === 403);
  check("order action: anon 401, customer 403", (await anon.call("/api/admin/orders/x", "POST", { action: "confirm" })).status === 401 && (await cust.call("/api/admin/orders/x", "POST", { action: "confirm" })).status === 403);

  // ---- placing an order
  const sofaBefore = await stock("p-sofa-3"), deskBefore = await stock("p-desk");
  const kpiBefore = (await admin.call("/api/admin/stats")).data.kpis.ordersToConfirm;
  r = await place(cust, [{ productId: "p-sofa-3", months: 12, qty: 1 }, { productId: "p-desk", months: 3, qty: 2 }]);
  const A = r.data.order;
  check("order A placed in Placed status", r.status === 201 && A.status === "Placed", A?.status);
  check("order A has a one-entry timeline", statuses(A) === "Placed" && A.timeline[0].by === "customer");
  check("stock reserved (sofa -1, desks -2)", (await stock("p-sofa-3")) === sofaBefore - 1 && (await stock("p-desk")) === deskBefore - 2);
  check("admin sees one more order waiting for confirmation", (await admin.call("/api/admin/stats")).data.kpis.ordersToConfirm === kpiBefore + 1);
  const list = (await admin.call("/api/admin/orders")).data.orders;
  check("admin orders list includes order A with customer details", list.some((o) => o.id === A.id && o.phone === addr.phone && o.address.includes("Sector 62")));
  check("another customer cannot open order A", (await other.call(`/api/orders/${A.id}`)).status === 404);

  // ---- rules: no skipping steps
  check("cannot pack an unconfirmed order (409)", (await act(A.id, { action: "pack" })).status === 409);
  check("cannot dispatch an unconfirmed order (409)", (await act(A.id, { action: "dispatch" })).status === 409);
  check("cannot deliver an unconfirmed order (409)", (await act(A.id, { action: "deliver" })).status === 409);
  check("cancelling needs a reason (400)", (await act(A.id, { action: "cancel" })).status === 400);
  check("unknown action refused (400)", (await act(A.id, { action: "explode" })).status === 400);
  check("unknown order is 404", (await act("RE-NOPE", { action: "confirm" })).status === 404);
  const rentalsA = await myRentals(A.id);
  check("customer has one rental per item", rentalsA.length === 2);
  r = await admin.call(`/api/admin/rentals/${rentalsA[0].id}/deliver`, "POST");
  check("Schedule board cannot deliver before the order is out for delivery (409)", r.status === 409, JSON.stringify(r.data));

  // ---- confirm, reschedule
  r = await act(A.id, { action: "confirm" });
  check("confirm moves to Confirmed", r.status === 200 && r.data.order.status === "Confirmed");
  check("confirming twice is refused (409)", (await act(A.id, { action: "confirm" })).status === 409);
  r = await act(A.id, { action: "reschedule", deliveryDate: "2020-01-01", slot: "12 PM to 3 PM" });
  check("rescheduling to a past date is refused (400)", r.status === 400);
  r = await act(A.id, { action: "reschedule", deliveryDate: plus(9), slot: "12 PM to 3 PM", note: "Customer asked for a later day" });
  check("rescheduling works and is recorded", r.status === 200 && r.data.order.deliveryDate === plus(9) && r.data.order.slot === "12 PM to 3 PM" && r.data.order.timeline.at(-1).note.includes("Delivery moved"));
  check("rentals follow the new date", (await myRentals(A.id)).every((x) => x.startDate === plus(9)));

  // ---- pack, dispatch
  r = await act(A.id, { action: "pack" });
  check("pack moves to Packed", r.status === 200 && r.data.order.status === "Packed");
  r = await act(A.id, { action: "dispatch", partnerName: "Ravi Kumar", partnerPhone: "9876543210" });
  check("dispatch moves to Out for delivery with the delivery person", r.status === 200 && r.data.order.status === "Out for delivery" && r.data.order.partner?.name === "Ravi Kumar");
  let mine = await myOrder(A.id);
  check("customer sees the live status and delivery person", mine.status === "Out for delivery" && mine.partner?.phone === "9876543210" && statuses(mine) === "Placed>Confirmed>Confirmed>Packed>Out for delivery");
  check("cannot reschedule once out for delivery (409)", (await act(A.id, { action: "reschedule", deliveryDate: plus(12), slot: "9 AM to 12 PM" })).status === 409);

  // ---- delivery from the Schedule board, item by item
  r = await admin.call(`/api/admin/rentals/${rentalsA[0].id}/deliver`, "POST");
  check("first item delivered from the Schedule board", r.status === 200 && r.data.rental.phase === "Active");
  mine = await myOrder(A.id);
  check("order stays Out for delivery while an item is still waiting", mine.status === "Out for delivery");
  r = await admin.call(`/api/admin/rentals/${rentalsA[1].id}/deliver`, "POST");
  mine = await myOrder(A.id);
  check("last item delivered makes the order Delivered", r.status === 200 && mine.status === "Delivered" && mine.timeline.at(-1).status === "Delivered");
  check("a delivered order cannot be cancelled (409)", (await act(A.id, { action: "cancel", note: "too late" })).status === 409);

  // ---- returns close the order
  for (const x of await myRentals(A.id)) await admin.call(`/api/admin/rentals/${x.id}/return`, "POST", { damageCharge: 0 });
  mine = await myOrder(A.id);
  check("returning every item closes the order", mine.status === "Closed" && mine.timeline.at(-1).status === "Closed");
  check("stock is back after returns", (await stock("p-sofa-3")) === sofaBefore && (await stock("p-desk")) === deskBefore);

  // ---- admin delivers a whole order in one go, and rejects another
  r = await place(cust, [{ productId: "p-tv-43", months: 6, qty: 1 }, { productId: "p-microwave", months: 3, qty: 1 }]);
  const Bo = r.data.order;
  for (const a of ["confirm", "pack", "dispatch"]) await act(Bo.id, { action: a });
  r = await act(Bo.id, { action: "deliver" });
  const rentalsB = await myRentals(Bo.id);
  check("order-level delivery starts every rental plan", r.status === 200 && r.data.order.status === "Delivered" && rentalsB.every((x) => x.phase === "Active"));

  const tvBefore = await stock("p-tv-43");
  r = await place(cust, [{ productId: "p-tv-43", months: 3, qty: 2 }]);
  const C = r.data.order;
  check("stock reserved for order C", (await stock("p-tv-43")) === tvBefore - 2);
  r = await act(C.id, { action: "cancel", note: "Out of stock on that date" });
  check("rejecting an order records the reason", r.status === 200 && r.data.order.status === "Cancelled" && r.data.order.timeline.at(-1).note === "Out of stock on that date");
  check("rejecting puts the stock back", (await stock("p-tv-43")) === tvBefore);
  check("the customer's rentals are cancelled too", (await myRentals(C.id)).every((x) => x.phase === "Cancelled"));
  check("rejecting twice is refused (409) and stock is not restored twice", (await act(C.id, { action: "cancel", note: "again" })).status === 409 && (await stock("p-tv-43")) === tvBefore);

  // ---- the customer cancels every item themselves
  r = await place(cust, [{ productId: "p-microwave", months: 3, qty: 1 }]);
  const D = r.data.order;
  const rd = await myRentals(D.id);
  r = await cust.call(`/api/rentals/${rd[0].id}/cancel`, "POST");
  mine = await myOrder(D.id);
  check("customer cancelling the last item cancels the order, noted as the customer's", r.status === 200 && mine.status === "Cancelled" && mine.timeline.at(-1).by === "customer");

  // ---- an order saved before the pipeline existed still works
  const legacy = (await admin.call("/api/admin/orders")).data.orders.filter((o) => o.timeline.some((t) => t.by === "system"));
  check("old orders (if any) show a built history", legacy.every((o) => o.timeline.length >= 2));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
