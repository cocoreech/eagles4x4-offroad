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

**Key decision:** Booking does NOT require signup. Guest checkout flow. A Booking reserves a **time slot only** — it does not carry promo/discount application. To avail a promo, a customer messages the branch through the **Inbox** to say they want it; staff note it against their booking manually. This is a branch/staff action, not a booking-flow step — which is why the **AI Concierge** never confirms promo eligibility itself (see AI Concierge, below), only relays the request via `needs_human`.

### Account / User
An authenticated user account (`role`: `customer` / `staff` / `admin` / `super_admin`). Bookings never require one — guest checkout is fully supported and unchanged. An account's value: **My Bookings** (live status tracking at `/bookings`, `/bookings/[code]`), the **Inbox** (chat with the AI Concierge and/or a human merchant, and where Touchpoints land), and in-app **Notifications**.

**Key decision:** Login exists only where there is real value behind it — that value has grown since launch (see below) but the principle is unchanged: login is additive, never a gate in the booking flow.

**Superseded:** the original launch decision below ("NO customer login") was reversed once accounts, the Inbox, and the AI Concierge shipped. Customer accounts now exist and are the home for booking tracking and two-way communication with the shop. This entry is kept for history — do not read it as current:
> ~~NO customer login at launch. Only admin/owner login exists. Customer-facing login (whatever value it eventually carries) is post-launch. Login plays no role in the booking flow, ever.~~

### Lead
Contact info (name + email/phone) captured from an anonymous homepage visitor when the **AI Concierge** escalates their guest conversation to a human (`needs_human: true`) — an anonymous session has no other reachable channel, so capturing contact info is required to complete that handoff, and doubles as lead generation. A Lead is NOT an **Account** — it has no login capability and is not a `profiles` row; it exists only as contact info tied to that conversation.

**Key decision:** matched to an Account by email if that person later signs up (no other link — see AI Concierge, "no auto-claim" for the conversation itself). On match, the Lead is marked **converted** (not deleted, not left untouched) — kept for conversion-rate history, but filtered out of the active staff follow-up queue.

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
The autonomous assistant that replies inside a customer's **Inbox** thread when no merchant is online. Grounded strictly in the live services/products catalog, app FAQ, current promos, and that customer's own bookings — it never invents facts or prices, and hands off to a human (`needs_human: true`) for anything outside that grounding (custom builds, diagnostics, exact quotes, complaints, booking changes/cancellations, or a customer wanting to **avail** a promo — availing is always a branch/staff action, never something the Concierge or the booking flow does itself). Distinct from a Touchpoint's "AI may suggest" drafting — the Concierge replies to the customer directly and unsupervised, in real time.

**Key decision:** replies send autonomously, with no human review before the customer sees them — wrong answers are caught after the fact via admin spot-checking, not prevented before send. See [ADR-0003](docs/adr/0003-ai-concierge-autonomous-with-after-the-fact-review.md).

**Key decision (planned):** the Concierge is being extended to anonymous homepage visitors (no account) via a chat widget — same grounding and escalation rules as the Inbox version, not a separate/simpler bot. A guest's conversation persists anonymously (browser session-scoped), not tied to any account; if the guest later creates an account, nothing links the two automatically (no auto-claim). This is distinct from a guest **Booking**, which remains fully decoupled from accounts as before.

For a guest, `needs_human: true` requires capturing a name + email/phone in the widget before completing the handoff — an anonymous session has no reachable channel otherwise, so this doubles as lead capture. Staff then follow up the same way guest Touchpoints already work (email, or one-tap click-to-chat). The widget also shows a fixed (non-AI-driven) account-creation nudge after the guest's 2nd message — a deterministic UI prompt, not something the model decides to say. Because anonymous access has no account to attach a usage budget to, guest replies get their own, stricter daily budget protected against both single-session abuse and cookie-clearing retries (not just IP alone — the codebase already treats IP-only limiting as unreliable in the Philippines due to CGNAT).

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

- Should a guest be prompted to create an account after completing a Booking (not required, just offered)? Parked — separate from the homepage Concierge widget decision.
- How do we link guest bookings to accounts when user creates one later? (email match? magic link?)
- What's the moderation workflow for community builds? (admin dashboard? approval queue?)
- When/how does the charity showcase go live? (separate page or homepage hero section?)
