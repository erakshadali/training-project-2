# RentEase: Product Requirements Document

**Project:** RentEase, a furniture and appliance rental platform
**Program:** Unified Mentor, Full Stack Web Development internship
**Author:** Akshad Ali
**Status:** v1.0 built and tested. Not yet deployed.

---

## 1. Context

Students and working professionals often relocate for study or work. Buying furniture and appliances for a place they may
leave within a year is expensive, hard to move and hard to maintain. Renting by the month removes the upfront cost, includes
delivery and repairs, and lets people move without hauling a fridge across the city.

RentEase is a web platform that offers that monthly rental solution. Existing services in this space (for example RentoMojo,
Furlenco, Cityfurnish, Rentickle and Fernish) were reviewed for good practice in catalog structure, plan selection and
delivery flows. No code, imagery or branding was copied. All visuals in RentEase are original.

## 2. Problem statement

Challenges faced by renters today:

| Challenge | How RentEase responds |
| --- | --- |
| High upfront cost of buying | Monthly rent from a few hundred rupees, with a refundable deposit |
| Difficulty transporting items when relocating | Free pickup, with a scheduled return date and slot |
| Lack of flexible plans | 3, 6 and 12 month plans, extendable at any time, with lower rent for longer plans |
| Limited local rental options | City-based service areas that can be switched on or off |
| Poor maintenance and support | A repair request flow with status updates and notes, free for normal wear and tear |

## 3. Objectives

**Primary**

- Provide affordable monthly rental options for furniture and appliances.
- Offer flexible tenure plans (3, 6 and 12 months) with the option to extend.
- Make browsing, renting, scheduling delivery and returning simple for a first-time user.
- Improve urban living convenience: free delivery, installation and maintenance.

**Secondary**

- Reduce unnecessary purchases by making renting the easy default.
- Promote sustainable consumption through reuse of durable goods.
- Enable easy relocation support through scheduled pickups.
- Create a scalable rental ecosystem: multiple cities, a managed catalog and operational tooling.

## 4. Scope

### In scope (built)

- Web-based, responsive, mobile-first platform
- Product catalog for furniture and appliances, with search, filters and sorting
- Monthly rental plans (3, 6 and 12 months) with live pricing
- Delivery scheduling (date and time slot) and pickup scheduling
- Customer accounts, cart, checkout (simulated payment) and order history
- Room Studio: try furniture in a photo of the customer's own room in 3D, with a fit and colour check
- Customer dashboard: active rentals, repair requests, extensions, returns, cancellations, damage claims and disputes
- Admin dashboard: KPIs, inventory, pricing, delivery and pickup schedule, repairs, returns and damage claims, disputes,
  users and service areas

### Out of scope

- Native mobile applications
- Cross-border rentals
- Advanced AI-based pricing
- Second-hand resale marketplace
- Real payment processing. Checkout is a simulation and no card or bank details are collected.

## 5. Personas

| Persona | Needs |
| --- | --- |
| **Riya, 22, student moving to a new city for a 10 month course** | Cheap, short-term setup. A bed, a desk and a fridge, delivered free. Easy return when the course ends. |
| **Karan, 27, professional on a one-year posting** | Reliable appliances with free repairs. Option to extend if the posting is extended. |
| **Admin (operations manager)** | See what is out, what is due for delivery or pickup, and what is broken. Keep stock accurate. Settle damage disputes fairly. |

## 6. Functional requirements

### 6.1 Customer features

| ID | Requirement | Status |
| --- | --- | --- |
| U1 | Register, log in and log out | Done |
| U2 | Browse products by category (Furniture: bed, sofa, table, wardrobe. Appliances: fridge, washing machine, TV) | Done |
| U3 | Search, filter by type and maximum rent, and sort | Done |
| U4 | View product details: rental price per plan, security deposit, tenure options, features and specifications | Done |
| U5 | Add to cart (quantity, tenure) and check out | Done |
| U6 | Choose delivery date, time slot and location (city) | Done |
| U7 | Manage active rentals: progress, end date, extend, schedule or cancel a pickup | Done |
| U8 | Request maintenance support and follow its status | Done |
| U9 | View rental history and past orders | Done |
| U10 | Cancel an item before delivery (free, until the day before) | Done |
| U11 | See the deposit refund after a return, view damage charges and dispute them | Done |

### 6.1b Room Studio (extra feature beyond the brief)

| ID | Requirement | Status |
| --- | --- | --- |
| R1 | Upload a photo of an empty room. The photo is processed in the browser and not uploaded | Done |
| R2 | Mark the floor corners and enter the floor size so furniture appears at real size and in the right perspective | Done |
| R3 | Place any catalog product as a 3D model, then move, rotate, duplicate and delete it | Done |
| R4 | Check the layout: floor space used, size fit per piece, colour match against the room, overlap and out-of-room warnings | Done |
| R5 | Suggest suitable products and furnish the room automatically | Done |
| R6 | Download the result as a picture and add the whole layout to the cart | Done |
| R7 | Save layouts to the customer account | Planned |

Why it matters: the biggest doubt when renting furniture is "will it fit and look right in my place?". Room Studio answers
that before the customer commits, which should reduce returns and early closures.

### 6.2 Admin and vendor features

| ID | Requirement | Status |
| --- | --- | --- |
| A1 | Add and manage product inventory (create, edit, hide, stock levels) | Done |
| A2 | Set rental pricing and tenure (rent and deposit per product. Plan discounts are fixed at 10% and 20%) | Done |
| A3 | Manage delivery and pickup schedules (board with customer, address and slot) | Done |
| A4 | Track product availability (units on shelf, reserved, out on rent, low-stock flags) | Done |
| A5 | Handle maintenance requests (status and customer-visible notes) | Done |
| A6 | Monitor returns and damages (process return, restore stock, raise damage charge) | Done |

### 6.3 Admin features

| ID | Requirement | Status |
| --- | --- | --- |
| M1 | Manage users and inventory (suspend and restore customers) | Done |
| M2 | Monitor orders and rentals | Done |
| M3 | Handle disputes and damage claims (uphold or waive with a reason) | Done |
| M4 | Generate reports and analytics (KPI overview, per-product utilization, orders per day) | Done |
| M5 | Manage service areas (add cities, switch on or off) | Done |

## 7. Business rules

- **Pricing.** Rent shown on a product is the 3 month price. The 6 month plan takes 10% off and the 12 month plan takes 20%
  off, rounded to whole rupees. A longer plan never costs more per month.
- **Deposit.** Refundable. Collected with the first month. Returned in full after the return check, less any damage charge
  the customer has not successfully disputed.
- **Delivery date.** Between 2 and 45 days from the day of ordering. Delivery and installation are free.
- **Plan clock.** A plan starts on the day the admin marks the item delivered, not on the day it is ordered.
- **Extension.** Adds 3, 6 or 12 months. The monthly rent drops to the tier price for the total plan length if that is lower.
  It never rises.
- **Early closure.** Returning before the plan ends costs one month of rent per unit. Returning on or after the end date is free.
- **Cancellation.** An item can be cancelled free of charge until the day before delivery. Stock returns to the shelf.
- **Repairs.** Free for normal wear and tear. Only after delivery and until return. At most 3 open requests per item.
- **Damage.** A charge can never exceed the deposit. The customer can dispute it. The disputed amount is held until the admin
  upholds or waives it.
- **Pricing changes.** Edits to a product's rent affect new orders only. Running rentals keep their rent.
- **Stock.** Reserved when an order is placed, restored on cancellation or return. Two customers cannot buy the last unit.

## 8. Non-functional requirements

| Area | Requirement | How it is met | Result |
| --- | --- | --- |
| Performance | Page load under 3 seconds | Server rendering, CSS-only hero animation, animation library loaded lazily, production build | See section 8.1 |
| Security | Secure login and payment readiness | Password hashing (bcrypt), signed httpOnly session cookie, server-side validation and pricing, role checks on every admin route. No card data is collected | See the technical document |
| Reliability | Accurate inventory tracking | Atomic stock reservation and restore. Tested with parallel orders | 5 parallel orders for the last 2 units: exactly 2 succeeded |
| Usability | Simple, mobile-first UI | Single-column mobile layouts, large tap targets, clear status chips, dialogs for each action | Checked at a 412 px viewport |
| Scalability | Multi-city expansion support | Service areas are data, not code. Admin can add a city without a deployment | Done |
| Accessibility | Usable with keyboard and screen reader | Labelled form fields, dialog focus handling, contrast-checked colours, heading order | Lighthouse accessibility 100 on the six pages audited (home, catalog, product, cart, login, register) |

### 8.1 Measured performance

Measured with Lighthouse on the production build, mobile emulation with simulated throttling (slow 4G and a 4x CPU
slowdown), run on a busy development laptop. Results vary between runs.

| Page | Performance | Largest contentful paint | Notes |
| --- | --- | --- | --- |
| Home | 73 to 93 (median 83) | about 2.0 to 2.2 s | Layout shift 0 |
| Product page | 79 to 94 (median 90) | about 2.0 s | Layout shift 0 |
| Catalog | about 88 | about 1.1 s | Layout shift 0 |

Unthrottled, server responses after the first request take about 30 to 50 ms. Accessibility, best practices and SEO score 100 on every page
audited (home, catalog, product, cart, login and register). The "under 3 seconds" requirement is met for first content and largest paint. Time to interactive on a
throttled mobile profile is 3.3 to 4.6 s on the heaviest pages, which is the main remaining improvement area.

## 9. User flows

**Renting an item**

1. Visit the platform and choose a city.
2. Browse or search furniture and appliances.
3. Open a product, pick a 3, 6 or 12 month plan and add to cart.
4. Log in or register, then review the cart (rent, deposit, free delivery).
5. Enter address, choose a delivery date and slot, and place the order.
6. The admin delivers and marks the item delivered. The plan clock starts.
7. Use the item. Raise a repair request if needed.
8. Near the end: extend the plan, or schedule a pickup.
9. The admin processes the return. Stock goes back on the shelf. The deposit is refunded, less any undisputed damage charge.

**Admin day**

1. Open the Overview and check "Needs attention".
2. Work through the Schedule board: deliveries to make, pickups booked.
3. Update repair requests. Leave notes for customers.
4. Decide any disputed damage claims.
5. Review stock and utilization. Adjust inventory or pricing.

## 10. Data requirements

| Entity | Key fields |
| --- | --- |
| Product | name, category, subcategory, 3 month rent, deposit, stock, features, specifications, popular, active |
| User | name, email, phone, password hash, role (user or admin), suspended flag |
| Order | order id, customer, address, city, pincode, delivery date and slot, payment method, lines, totals, status |
| Rental | one per ordered item: product, quantity, plan length, rent, deposit, start and end date, status, extensions, pickup request |
| Maintenance request | rental, category, description, status, note, created and resolved time |
| Claim | rental, amount, note, status (charged, disputed, upheld, waived), dispute message, resolution note |
| Service area | city name, active |

Seed data: 17 products (9 furniture, 8 appliances), 8 cities, and an optional admin account created from environment settings.

## 11. Key performance indicators

| KPI | Definition in the dashboard |
| --- | --- |
| Number of active rentals | Units currently with customers: delivered and not yet returned |
| Monthly recurring revenue (MRR) | Sum of monthly rent across all active rentals |
| Product utilization rate | Units out on rent divided by all units owned (out, reserved for delivery and on the shelf). Shown overall and per product |
| Customer retention rate | Share of customers who have ordered that placed 2 or more orders or extended a plan ("repeat customers") |
| Maintenance request resolution time | Average time from a request being raised to it being marked resolved |

Also shown: deposits held, deliveries and pickups due, open repairs, open disputes, low-stock products and orders per day.

## 12. Assumptions and constraints

**Assumptions**

- Users prefer rentals over ownership when the stay is short or uncertain.
- Reliable delivery partners exist. In this build the admin acts as the delivery team.
- Inventory is stored locally, in the cities served.

**Constraints**

- Logistics and maintenance cost. Pricing is a demo and not tuned to real costs.
- Product wear and tear. Handled through the deposit and damage claim flow.
- Inventory availability limits what can be offered. Stock is exact, not forecast.
- No real payments. Checkout is simulated by design.

## 13. Deliverables

| Deliverable | Where |
| --- | --- |
| Functional web application | Source in this repository. Run locally as described in the README |
| Admin dashboard | `/admin` |
| PRD and technical documentation | `docs/PRD.md` and `docs/TECHNICAL.md` |
| Deployment-ready build | `npm run build` passes. Deployment steps in `docs/TECHNICAL.md` |
| Automated tests | `npm test` (26 unit tests) and the API test scripts in `scripts/` |

## 14. Expected impact

- Affordable living solutions for urban users: a bed, desk and fridge for well under what one of them costs to buy.
- Reduced financial burden: no large upfront payment. The deposit comes back.
- Sustainable product usage: items are reused across customers instead of being discarded after a short stay.
- Improved rental experience: one place to order, repair, extend and return, with clear status at every step.

## 15. Future enhancements

- Mobile applications
- Subscription bundles (for example a "studio flat" pack)
- Real online payments with auto-renewals
- Smart appliance tracking
- Furniture customization options
- Email and SMS notifications for delivery, pickup and repair updates
- Admin-editable plan discounts and delivery fees by city
- Photo evidence on damage claims and repair requests
