# RentEase

**Live demo:** https://rentease-one-khaki.vercel.app

A furniture and appliance rental platform: browse a catalog, pick a 3, 6 or 12 month plan, schedule delivery, and manage rentals.
Built as a full stack project for the Unified Mentor internship.

**Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, MongoDB (Mongoose), JWT cookie auth (jose), Zod validation.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: add a real MONGODB_URI and AUTH_SECRET
npm run dev                  # http://localhost:3000
```

With no `MONGODB_URI` the dev server starts a temporary in-memory MongoDB, seeds the catalog and (if `ADMIN_EMAIL` and
`ADMIN_PASSWORD` are set) an admin account. Data resets when the server restarts. For a real database, set `MONGODB_URI`
(for example a free MongoDB Atlas cluster). In production `MONGODB_URI` and `AUTH_SECRET` are required.

## What works now

- Catalog of 17 products loaded from MongoDB, with stock tracking (sold out and low stock states)
- Search, filters, sorting, product pages with live plan pricing, cart drawer and cart page
- Accounts: register, log in, log out (bcrypt password hashes, signed httpOnly session cookie)
- Checkout and orders saved in MongoDB. Prices are recalculated on the server, stock is reserved atomically,
  and customers can only read their own orders
- User dashboard (`/account`): every ordered item becomes a rental with start and end dates and a live status
  (Awaiting delivery, Active, Plan ended, Return scheduled, Returned, Cancelled). From there a customer can:
  - raise **repair requests** (up to 3 open per item) and follow their status
  - **extend** a plan, with a live preview of the new end date and the lower monthly rent a longer plan earns
  - **schedule or cancel a pickup**, with the early-closure fee (one month of rent) shown before booking
  - **cancel** an item until the day before delivery (stock goes back on the shelf)
  - browse order history
  - see the deposit refund after a return, read any damage charge, and **dispute** it
- **Admin dashboard** (`/admin`, admins only; customers get a 404):
  - **Overview** with live KPIs: active rentals, monthly recurring revenue, deposits held, product utilization,
    repeat customers, repair resolution time, orders in the last 7 days, and a "needs attention" list
  - **Schedule** board for deliveries and pickups with customer, phone, address and slot. Mark delivered starts the
    plan clock; Process return puts the item back in stock and can raise a damage charge against the deposit
  - **Inventory**: add products, edit rent, deposit and stock, hide or show items. Price changes only affect new orders
  - **Repairs** queue with status and a note the customer can read
  - **Claims**: uphold or waive damage charges, including ones the customer disputed
  - **Customers**: list with order counts, suspend or restore accounts (admins are protected)
  - **Areas**: switch delivery cities on or off or add new ones. At least one city must stay active

## Room Studio (`/room-studio`)

Upload a photo of an empty hall and try furniture in it, in 3D, at its real size.

1. **Upload a photo** (stays in the browser, never sent to a server) or try the built-in sample hall.
2. **Mark the floor**: drag four dots onto the floor corners and enter the room size in feet. From those corners the app works
   out where the camera was (a homography and pose estimate), so 3D furniture is drawn in the same perspective as the photo.
3. **Place furniture**: all 17 products are available as 3D models built from boxes and cylinders, sized to their real
   dimensions and coloured like the product. Drag to move, rotate, duplicate or delete. Shadows fall on the floor.
4. **Room Check**: floor space used (roomy, balanced, crowded), a size-fit rating for every piece, a colour match score
   against the floor and wall colours read from the photo, overlap and out-of-room warnings, and a ranked list of pieces that
   suit the room.
5. **Furnish it for me** lays out a TV, a sofa facing it, a shelf and a desk or dining set that suit the room, **Download
   picture** saves the composite as a PNG, and **Add all to cart** puts the layout in the cart at the chosen plan.

The colour score is a design rule of thumb (contrast with the floor, hue relation to the walls, light or dark contrast), not a
guarantee. Three.js loads only when the studio opens.

## API

| Method | Route | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | Creates an account and logs in |
| POST | `/api/auth/login` | Logs in |
| POST | `/api/auth/logout` | Clears the session |
| GET | `/api/auth/me` | Current user or `null` |
| GET | `/api/orders` | Your orders |
| POST | `/api/orders` | Place an order (login required) |
| GET | `/api/orders/[id]` | One order (owner or admin) |
| GET | `/api/rentals` | Your rentals with computed status and progress |
| POST | `/api/rentals/[id]/extend` | Add 3, 6 or 12 months |
| POST / DELETE | `/api/rentals/[id]/return` | Schedule, change or cancel a pickup |
| POST | `/api/rentals/[id]/cancel` | Cancel before delivery |
| GET / POST | `/api/maintenance` | List or raise repair requests |
| GET / POST | `/api/layouts` | List or save Room Studio layouts (max 5 per customer) |
| GET / PUT / DELETE | `/api/layouts/[id]` | Open, update or delete one saved layout |
| GET | `/api/claims` | Your damage claims |
| POST | `/api/claims/[id]/dispute` | Dispute a damage charge |
| GET | `/api/admin/stats` | Admin: KPIs and per-product utilization |
| GET | `/api/admin/rentals` | Admin: all rentals with customer details |
| POST | `/api/admin/rentals/[id]/deliver` | Admin: mark delivered (starts the plan clock) |
| POST | `/api/admin/rentals/[id]/return` | Admin: record the return, restore stock, optional damage charge |
| GET / POST | `/api/admin/products` | Admin: list all products or add one |
| PATCH / DELETE | `/api/admin/products/[id]` | Admin: edit or hide a product |
| GET | `/api/admin/maintenance` | Admin: repairs queue |
| PATCH | `/api/admin/maintenance/[id]` | Admin: set status and note |
| GET | `/api/admin/claims` | Admin: all damage claims |
| PATCH | `/api/admin/claims/[id]` | Admin: uphold or waive |
| GET | `/api/admin/users` | Admin: customers |
| PATCH | `/api/admin/users/[id]` | Admin: suspend or restore |
| GET / POST | `/api/admin/areas` | Admin: list or add service cities |
| PATCH | `/api/admin/areas/[id]` | Admin: switch a city on or off |

All `/api/admin/*` routes return 401 when logged out and 403 for customers.

## Documentation

- [Product requirements (PRD)](docs/PRD.md): problem, objectives, scope, requirements, business rules, KPIs and measured results
- [Technical documentation](docs/TECHNICAL.md): architecture, data model, full API reference, security, testing, deployment

## Tests and checks

```bash
npm test            # 47 unit tests: pricing, plan dates, tiers, refunds, Room Studio camera math, overlap, colour scoring
npm run typecheck   # strict TypeScript
npm run lint        # ESLint
BASE_URL=http://localhost:3000 bash scripts/api-test-admin.sh     # end-to-end API tests (needs a running server)
BASE_URL=http://localhost:3000 bash scripts/api-test-rentals.sh
node scripts/live-e2e-test.mjs https://your-site.vercel.app      # 100+ checks of every feature on a deployed site (needs ADMIN_* and DEMO_* in .env.local)
```

## Deploy

Vercel plus MongoDB Atlas. Set `MONGODB_URI`, `AUTH_SECRET` and, optionally, `ADMIN_EMAIL` and `ADMIN_PASSWORD` as environment
variables, then deploy. Full steps are in [docs/TECHNICAL.md](docs/TECHNICAL.md#10-deployment-vercel-and-mongodb-atlas).

Payments are a simulation. No card or bank details are collected.
