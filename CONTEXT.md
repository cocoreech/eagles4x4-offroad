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
- Upload and share builds
- Moderate/admin access (owner)

**Key decision:** Account creation is optional at booking time but required to participate in community (uploads).

### Build (community)
A vehicle project shared by a user in the gallery. Two types:

1. **Verified Build** — posted by a customer who booked a service with us. Auto-approved, badged as "Built by Eagles 4×4".
2. **Community Build** — posted by anyone (verified or not). Requires moderation before going live. May not be built by us.

**Key decision:** Only past customers (booking records) qualify for "Verified" status. Community posts are open but moderated.

### Build (internal)
A portfolio piece showcasing a vehicle project we completed. Displayed on `/builds` (sphere gallery). Owner-managed in admin panel. Not user-generated.

---

## Feature Areas

### Public Pages
- `/` — homepage with sphere gallery teaser, testimonials, CTA to book
- `/builds` — full sphere gallery (WebGL). Shows only internal builds (owner portfolio).
- `/services` — service offerings with quote calculator
- `/events` — event listings (if any)

### Booking Flow
- `/login` → email magic link → `/bookings/new` → book → pay (PayMongo) → confirmation email with account claim link
- Guest checkout; no signup required before payment
- Link to create account offered post-booking

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
