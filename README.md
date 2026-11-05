# RentEase

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

## What works now (build step 2)

- Catalog of 17 products loaded from MongoDB, with stock tracking (sold out and low stock states)
- Search, filters, sorting, product pages with live plan pricing, cart drawer and cart page
- Accounts: register, log in, log out (bcrypt password hashes, signed httpOnly session cookie)
- Checkout and orders saved in MongoDB. Prices are recalculated on the server, stock is reserved atomically,
  and customers can only read their own orders

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

## Roadmap

Step 3 user dashboard (maintenance requests, extend, return), step 4 admin dashboard and reports, step 5 PRD and technical
documentation, tests and deployment.

Payments are a simulation. No card or bank details are collected.
