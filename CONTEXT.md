# Domain Glossary — Eagles 4×4 Offroad

> Shared language for the team. Updated as decisions crystallize.

---

## Core Concepts

### Booking
A service request from a customer for work on their vehicle. Includes:
- Vehicle details (make, model, year)
- Selected services/products
- Quote (estimated cost)
- Payment (via PayMongo)

**Key decision:** Booking does NOT require signup. Guest checkout flow.

### Account / User
An authenticated user account. Required only to:
- Upload and share community Builds (the "membership"-equivalent value)
- Moderate/admin access (owner)

**Key decision:** Login exists only where there is real value behind it. Bookings need NO login (like Rapide PH, which has no customer accounts at all). The future customer-login value is loyalty/aftercare — warranty registration, points, member promos (the Seng Li model) — not just community uploads.

**Launch decision:** NO customer login at launch. Only admin/owner login exists. Customer-facing login (whatever value it eventually carries) is post-launch. Login plays **no role in the booking flow**, ever.

### Build (community)
A vehicle project shared by a user in the gallery. Two types:

1. **Verified Build** — posted by a customer who booked a service with us. Auto-approved, badged as "Built by Eagles 4×4".
2. **Community Build** — posted by anyone (verified or not). Requires moderation before going live. May not be built by us.

**Key decision:** Only past customers (booking records) qualify for "Verified" status. Community posts are open but moderated.

### Build (internal)
A portfolio piece showcasing a vehicle project we completed. Displayed on `/builds` (sphere gallery). Owner-managed in admin panel. Not user-generated.

### Touchpoint
A scheduled, drafted, trackable outreach to a customer about a Booking. One unified concept differentiated by **type** + **timing** + **template**:
- **Reminder** — a pre-service Touchpoint ("your appointment is tomorrow").
- **Follow-up** — a post-service Touchpoint (post-service check-in, maintenance/PMS reminder, etc.).

A Touchpoint carries a message drafted from a template, which **admins can edit before sending** (so it doesn't sound robotic); **AI may suggest** draft wording. Delivery is hybrid: auto by email where possible, otherwise one-tap click-to-chat by staff. Every Touchpoint tracks a status (e.g. pending → sent → replied/no-response).

**Key decision:** Reminders and Follow-ups are NOT separate systems — both are Touchpoints, differing only by type/timing/template.

---

## Feature Areas

### Public Pages
- `/` — homepage with sphere gallery teaser, testimonials, CTA to book
- `/builds` — full sphere gallery (WebGL). Shows only internal builds (owner portfolio).
- `/services` — service offerings with quote calculator
- `/events` — event listings (if any)

### Booking Flow
- `/bookings/new` → book → pay (PayMongo) → confirmation (Touchpoint message)
- Guest checkout; NO login anywhere in the booking path

### Booking Tracking
**Key decision:** There is no customer-facing tracking surface. Customers do NOT log in, do NOT browse a "my bookings" list, and there is NO track-my-build page, link, lookup form, or progress photos. Status updates are **pushed** to the customer as Touchpoint messages (Viber/SMS/email) when the admin changes the booking status — the message IS the update (the Rapide model). The only on-site screen is the post-booking confirmation (`/bookings/[code]/success`), shown once right after submitting; it confirms receipt, it is not a tracking page.

### Community (Future)
- `/community` or `/builds/shared` — community gallery of user-submitted builds (verified + moderated)
- `/builds/new` — upload/create a build post (requires account)
- Account required for uploads; optional for viewing

### Charity Showcase (Future)
- `/charity` or section on homepage — owner-curated narrative about which charity is supported and how. Read-only. No user contribution.

---

## Open Questions / TBD

- How do we link guest bookings to accounts when user creates one later? (email match? magic link?)
- What's the moderation workflow for community builds? (admin dashboard? approval queue?)
- When/how does the charity showcase go live? (separate page or homepage hero section?)
