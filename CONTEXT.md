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
An authenticated user account (`role`: `customer` / `staff` / `admin` / `super_admin`). Bookings never require one — guest checkout is fully supported and unchanged. An account's value: **My Bookings** (live status tracking at `/bookings`, `/bookings/[code]`), the **Inbox** (chat with the AI Concierge and/or a human merchant, and where Touchpoints land), and in-app **Notifications**.

**Key decision:** Login exists only where there is real value behind it — that value has grown since launch (see below) but the principle is unchanged: login is additive, never a gate in the booking flow.

**Superseded:** the original launch decision below ("NO customer login") was reversed once accounts, the Inbox, and the AI Concierge shipped. Customer accounts now exist and are the home for booking tracking and two-way communication with the shop. This entry is kept for history — do not read it as current:
> ~~NO customer login at launch. Only admin/owner login exists. Customer-facing login (whatever value it eventually carries) is post-launch. Login plays no role in the booking flow, ever.~~

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

A Touchpoint carries a message drafted from a template, which **admins can edit before sending** (so it doesn't sound robotic); **AI may suggest** draft wording — a human-in-the-loop drafting aid, distinct from the AI Concierge below, which replies to customers directly and unsupervised. Delivery is hybrid: for account-holders it's routed into their **Inbox** thread (plus a doorbell nudge) so they can reply two-way; for guests, auto by email where possible, otherwise one-tap click-to-chat by staff. Every Touchpoint tracks a status (e.g. pending → sent → replied/no-response).

**Key decision:** Reminders and Follow-ups are NOT separate systems — both are Touchpoints, differing only by type/timing/template.

### AI Concierge
The autonomous assistant that replies inside a customer's **Inbox** thread when no merchant is online. Grounded strictly in the live services/products catalog, app FAQ, current promos, and that customer's own bookings — it never invents facts or prices, and hands off to a human (`needs_human: true`) for anything outside that grounding (custom builds, diagnostics, exact quotes, complaints, booking changes/cancellations). Distinct from a Touchpoint's "AI may suggest" drafting — the Concierge replies to the customer directly and unsupervised, in real time.

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
**Superseded:** account-holders now get self-serve tracking — "My Bookings" at `/bookings` and a live status page at `/bookings/[code]`, updated as admin advances the status pipeline. Guests (no account) keep the original model below: status changes pushed as Touchpoint messages, no on-site tracking surface. The account/guest split is the current boundary — not "tracking doesn't exist."
> ~~There is no customer-facing tracking surface. Customers do NOT log in, do NOT browse a "my bookings" list, and there is NO track-my-build page, link, lookup form, or progress photos. Status updates are pushed to the customer as Touchpoint messages (Viber/SMS/email) when the admin changes the booking status — the message IS the update (the Rapide model). The only on-site screen is the post-booking confirmation, shown once right after submitting; it confirms receipt, it is not a tracking page.~~

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
