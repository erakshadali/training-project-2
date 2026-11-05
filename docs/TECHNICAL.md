# RentEase: Technical Documentation

## 1. Architecture

RentEase is a single Next.js application (App Router) that serves the pages and the JSON API, backed by MongoDB.

```
Browser (React 19, Tailwind, Framer Motion)
   |  HTML from server components, JSON from route handlers
   v
Next.js 16 server
   |-- app/*            pages (server components) and client islands
   |-- app/api/*        route handlers (auth, orders, rentals, maintenance, claims, admin)
   |-- lib/*            pricing, rental rules, auth, validation helpers
   |-- models/index.ts  Mongoose schemas
   v
MongoDB (Atlas in production, temporary in-memory instance in development)
```

Key design choices:

- **Server is the source of truth.** The browser sends product ids, plan length and quantity. The server looks up prices and
  stock itself. Editing the page cannot change what an order costs.
- **Rules live in pure functions** (`lib/pricing.ts`, `lib/rentals.ts`, `lib/claims.ts`). They are used by the server and the
  browser, so the preview a customer sees is computed by the same code the server enforces. They are covered by unit tests.
- **Catalog and service areas are loaded in the root layout** and passed to client components through a context, so product
  data is available everywhere without extra requests.
- **Dates are ISO strings** (`yyyy-mm-dd`). Plan status is derived from today's date, never stored, so it cannot go stale.

## 2. Technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19 | Server rendering for speed and SEO, route handlers for the API |
| Language | TypeScript (strict) | Catches mistakes before they run |
| Styling | Tailwind CSS 4 with a custom colour palette | Fast, consistent, mobile-first |
| Animation | Framer Motion (lazy loaded), plus CSS keyframes for the hero | Rich interactions without blocking first paint |
| 3D | Three.js, loaded only on the Room Studio page | Real 3D furniture over the customer's photo |
| Icons | lucide-react | Consistent, tree-shakable |
| Database | MongoDB with Mongoose 9 | Flexible documents that fit orders and rentals |
| Auth | bcryptjs, jose (JWT), httpOnly cookie | No third-party auth service needed |
| Validation | Zod 4 | One schema per request, clear field errors |
| Tests | Vitest, plus curl-based API scripts | Fast unit tests and an end-to-end check of the API |

## 3. Project structure

```
src/
  app/                 pages and API routes
    api/auth/*         register, login, logout, me
    api/orders/*       place and read orders
    api/rentals/*      list, extend, return (pickup), cancel
    api/maintenance    repair requests
    api/claims/*       customer view and dispute of damage charges
    api/admin/*        admin-only operations
    admin/             admin dashboard page (server-side role check)
    account/, cart/, checkout/, login/, register/, orders/[id], products/[slug]
  components/          UI (home sections, cards, dashboards, dialogs)
    admin/             admin dashboard sections
  context/             Auth, Catalog (products and cities), Cart (persisted in the browser)
  data/                seed products and configuration
  lib/                 db connection, auth, pricing and rental rules, serializers
  models/              Mongoose schemas
scripts/               API test scripts and a local database helper
docs/                  this document and the PRD
```

## 4. Data model

| Collection | Fields | Indexes |
| --- | --- | --- |
| `products` | pid, slug, name, category, subcategory, art, tint, blurb, description, rent, deposit, features, specs, popular, stock, active | unique pid, unique slug, category |
| `users` | name, email, phone, passwordHash, role, disabled | unique email |
| `orders` | orderId, userId, contact and address, city, pincode, deliveryDate, slot, payment, lines[], rentPerMonth, deposit, status | unique orderId, userId |
| `rentals` | rentalId, orderId, userId, pid, name, qty, months, rentPerMonth, deposit, startDate, endDate, status, extensions[], returnRequest, deliveredAt, returnedAt | unique rentalId, unique (orderId, pid), userId |
| `maintenances` | requestId, userId, rentalId, productName, category, description, status, note, resolvedAt | unique requestId, userId, rentalId |
| `claims` | claimId, rentalId, userId, productName, amount, note, status, disputeMessage, resolutionNote, resolvedAt | unique claimId, userId, rentalId |
| `serviceareas` | name, active | unique name |

Order lines and rentals store a **snapshot** of name, rent and deposit at the time of ordering, so later price edits never
change history or running rentals.

Rental status stored: `Scheduled`, `Return scheduled`, `Returned`, `Cancelled`. The visible phase (Awaiting delivery, Active,
Plan ended, and so on) is computed from the stored status and today's date.

## 5. API reference

All responses are JSON. Errors have the shape `{ "error": "message", "fields": { "field": "message" } }`.
Customer routes need a session cookie. `/api/admin/*` routes return 401 when logged out and 403 for customers.

### Auth

| Method | Route | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | name, email, phone, password (min 8) | Creates the account and logs in. 409 if the email exists |
| POST | `/api/auth/login` | email, password | Same message for unknown email and wrong password. 403 for suspended accounts. Throttled |
| POST | `/api/auth/logout` | none | Clears the cookie |
| GET | `/api/auth/me` | none | `{ user }` or `{ user: null }` |

### Orders and rentals (customer)

| Method | Route | Notes |
| --- | --- | --- |
| POST | `/api/orders` | Body: contact, address, city, pincode, deliveryDate, slot, payment, lines[{productId, months, qty}]. Prices and stock come from the database. 400 for a bad date or a city we do not serve. 409 if stock is short |
| GET | `/api/orders`, `/api/orders/[id]` | Own orders only. Other users get 404 |
| GET | `/api/rentals` | Own rentals with computed phase, days left and progress |
| POST | `/api/rentals/[id]/extend` | `{ addMonths: 3 or 6 or 12 }`. Only for delivered rentals |
| POST | `/api/rentals/[id]/return` | `{ date, slot }`. Date from tomorrow to 30 days after the plan ends. Returns the early closure fee in `returnRequest` |
| DELETE | `/api/rentals/[id]/return` | Cancels a scheduled pickup |
| POST | `/api/rentals/[id]/cancel` | Until the day before delivery. Restores stock |
| GET, POST | `/api/maintenance` | Raise or list repair requests |
| GET | `/api/claims` | Own damage claims |
| POST | `/api/claims/[id]/dispute` | `{ message }`. Only while the claim is "Charged" |

### Admin

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/admin/stats` | KPIs, per-product utilization, orders per day |
| GET | `/api/admin/rentals` | All rentals with customer and address |
| POST | `/api/admin/rentals/[id]/deliver` | Mark delivered and start the plan clock |
| POST | `/api/admin/rentals/[id]/return` | `{ damageCharge?, damageNote? }`. Restores stock, optionally raises a claim |
| GET, POST | `/api/admin/products` | List all products (including hidden) or add one |
| PATCH, DELETE | `/api/admin/products/[id]` | Edit fields or hide. Products are never deleted |
| GET | `/api/admin/maintenance` | Repair queue |
| PATCH | `/api/admin/maintenance/[id]` | `{ status, note }` |
| GET | `/api/admin/claims` | All claims |
| PATCH | `/api/admin/claims/[id]` | `{ decision: "Upheld" or "Waived", note }` |
| GET | `/api/admin/users` | Customers with order and item counts |
| PATCH | `/api/admin/users/[id]` | `{ disabled }`. Admins cannot be suspended |
| GET, POST | `/api/admin/areas` | List or add cities |
| PATCH | `/api/admin/areas/[id]` | `{ active }`. At least one city must stay active |

### 5b. Room Studio

Room Studio runs entirely in the browser. No photo is sent to the server.

| Piece | File | What it does |
| --- | --- | --- |
| Geometry | `lib/roomMath.ts` | Solves the homography from the four marked floor corners to the floor rectangle, recovers the camera pose (assuming a typical phone field of view, adjustable), and builds a Three.js camera that matches the photo. Also footprint, overlap (separating axis test), out-of-room and clamping helpers |
| Colour and fit | `lib/roomColor.ts` | Reads the median floor and wall colours from the photo, converts to CIE L*a*b* and HSL, scores a product colour (40 points contrast with the floor, 30 hue relation to the walls, 30 light or dark contrast), rates size fit and floor crowding |
| Sizes | `lib/roomDims.ts` | Real width, depth and height in feet for every product, with defaults per kind of product |
| 3D models | `components/room/models.ts` | Procedural models for the 13 kinds of product, coloured with the product tint |
| 3D scene | `components/room/Scene.tsx` | Transparent WebGL layer over the photo. Soft shadows on a shadow-catcher floor, picking and dragging on the floor plane, PNG export |
| Screens | `components/room/RoomStudio.tsx` | Upload, floor marking with a live perspective grid and a 3 ft reference square, and the studio |
| Sample | `lib/sampleRoom.ts` | Draws an empty hall with a known camera so the feature can be tried without a photo |

How the camera is recovered: with the floor corners at known positions on the floor plane (X, Z), the image points satisfy
`p = K [r1 r2 t] [X Z 1]^T`. The homography H is solved from the four correspondences, then `K^-1 H` gives `r1`, `r2` and `t` up to
scale. The rotation is orthonormalised, the floor normal gives "up", and the result is converted to Three.js conventions.
The unit tests project known 3D points with an independent ground-truth camera and check the recovered camera lands within half
a pixel, and that its position and height are recovered.

Honest limits: the camera angle is assumed (65 degrees by default, adjustable with the photo-angle slider), lens distortion is
ignored, and the 3D models are simple shapes, not photographs of the real product. Scale is only as accurate as the room size the
customer enters. The colour score is a rule of thumb.

## 6. Security

| Concern | Measure |
| --- | --- |
| Passwords | Hashed with bcrypt (cost 12). Never returned by any endpoint |
| Sessions | JWT signed with `AUTH_SECRET`, stored in an `httpOnly`, `SameSite=Lax` cookie, `Secure` in production. 7 day expiry |
| Authorization | Each admin route calls `requireAdmin()`. Customer routes filter by the session user id, so another user's data returns 404 |
| Price tampering | Prices, deposits and totals are computed on the server from the database. Client-sent prices are ignored (tested) |
| Input validation | Every request body is validated with Zod. Errors are returned per field |
| Brute force | Login and registration are throttled per IP (in-memory, per server instance) |
| Account enumeration | Login returns the same message for unknown email and wrong password |
| Suspended users | Cannot log in. Existing sessions stop working on the next request |
| Open redirect | The login `next` parameter must start with a single `/` |
| Secrets | Read from environment variables. `.env*` files are git-ignored. Production refuses to start without `AUTH_SECRET` and `MONGODB_URI` |
| Payments | Simulated. No card, bank or UPI details are requested or stored |
| Concurrency | Stock changes use conditional atomic updates. Returns, cancellations and deliveries are filtered on current status so a double click or two admins cannot apply them twice |

Known limits for a demo: the login throttle is per server instance (use a shared store such as Redis for a multi-instance
deployment), there is no email verification or password reset, and there is no CSRF token beyond `SameSite=Lax` cookies and
JSON-only request bodies.

## 7. Testing

| Kind | Command | Coverage |
| --- | --- | --- |
| Unit tests | `npm test` | 47 tests: plan pricing and rounding, plan dates (month-end and leap-year clamping), price tiers, plan phase, early closure fee, deposit refund with damage claims, camera recovery from floor corners, footprint overlap, colour reading and scoring, size fit |
| Type check | `npm run typecheck` | Strict TypeScript |
| Lint | `npm run lint` | ESLint with the Next.js and React rules |
| API tests | `bash scripts/api-test-rentals.sh`, `bash scripts/api-test-admin.sh` | End to end against a running server: auth, validation, access control, orders, stock, extension, return, cancellation, repairs, claims and disputes, users, areas, stats |
| Accessibility and performance | Lighthouse (mobile) | See the PRD, section 8.1 |

Run the API tests against a local server started with `ADMIN_EMAIL=admin@rentease.local ADMIN_PASSWORD=<your test password>`.
Set `BASE_URL` if the server is not on port 3000. They create their own test users.

Results at the time of writing: all unit tests pass, type check and lint are clean, and every API test group passes.
One bug found by the API tests during development (a 500 on "mark delivered") was fixed.

## 8. Running locally

```bash
npm install
npm run dev
```

With no `MONGODB_URI`, the development server starts a temporary in-memory MongoDB, seeds the catalog and cities, and creates the
admin account if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set. Data resets on restart.

To run the **production build** locally without Atlas:

```bash
node scripts/local-db.mjs                                 # terminal 1: temporary database
npm run build
MONGODB_URI=mongodb://127.0.0.1:27018 AUTH_SECRET=<16+ random characters> npm run start   # terminal 2
```

## 9. Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Production | MongoDB connection string (for example from MongoDB Atlas) |
| `MONGODB_DB` | No | Database name. Default `rentease` |
| `AUTH_SECRET` | Production | At least 16 random characters. Signs login cookies |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | No | Creates an admin account the first time the database is seeded. Use a strong password |

## 10. Deployment (Vercel and MongoDB Atlas)

1. Create a free MongoDB Atlas cluster, a database user, and allow network access (for Vercel, allow `0.0.0.0/0` or use the
   Vercel integration). Copy the connection string.
2. Push this repository to GitHub.
3. Import the repository into Vercel. The framework is detected as Next.js. No build settings need changing.
4. Add the environment variables from section 9 in the Vercel project settings.
5. Deploy. On the first request the app seeds the products and cities. If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, the admin
   account is created at the same time.
6. Open the site, log in as the admin, and check `/admin`.

Notes: the in-memory database helper is a development dependency and is never used in production (the app throws a clear error
if `MONGODB_URI` is missing). Pages are rendered on demand because they read the catalog from the database.

## 11. Known limitations and next steps

- Payments are simulated. A real integration (for example a payment gateway) would add payment status to orders and
  auto-renewal for monthly rent.
- The 6 and 12 month discounts are fixed in code. A settings collection would make them admin-editable.
- No email or SMS notifications yet.
- The home and product pages score between about 73 and 94 for performance on throttled mobile emulation. The remaining cost is
  mostly JavaScript hydration. Next steps are trimming client components on static sections and streaming the catalog.
- The login throttle is per instance. Use a shared store in a multi-instance deployment.
