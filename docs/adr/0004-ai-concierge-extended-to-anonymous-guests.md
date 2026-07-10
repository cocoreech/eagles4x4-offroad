# AI Concierge extends to anonymous homepage guests; escalation requires contact capture into a separate Lead concept

**Status:** accepted

The Concierge currently only exists inside an account holder's Inbox thread (`requireConfirmed()`-gated). We decided to extend the *same* Concierge (same grounding, same escalation rules) to a homepage widget for anonymous guests, rather than build a second, simpler bot — the grounding/escalation machinery already exists and answers the same questions either way. A guest's conversation persists anonymously (session-scoped, no account required), with no auto-claim if they later sign up. Because an anonymous session has no reachable channel, `needs_human: true` for a guest requires capturing name + email/phone before completing the handoff — this doubles as lead generation, but the captured contact info is modeled as a new **Lead** concept, not a `profiles` row, since a Lead has no login capability and `profiles`/Account is explicitly defined in this glossary as *authenticated*. A Lead is matched to an Account by email if the person later signs up, and marked converted (not deleted) so conversion rate stays measurable. Because there's no account to key a usage budget on, guest AI replies get their own budget, keyed on session **and** IP together — IP alone was rejected because this codebase already treats IP-only limiting as unreliable in the Philippines (CGNAT means many real users share one IP), so session-only would let an abuser reset their budget just by clearing cookies.

**Considered and rejected:**
- **A separate, simpler FAQ-only bot for guests** — rejected; duplicates grounding/escalation logic that already exists and works, for no real benefit.
- **Shadow `profiles` row on contact capture** — rejected; contradicts the glossary's own definition of Account as authenticated, and would pollute the admin Customers list with people who never signed up.
- **Auto-claim the guest conversation into the account on signup** — rejected (for now); adds matching/merge complexity before there's evidence guests actually return to sign up.
- **IP-only rate limiting for the anonymous AI budget** — rejected; this codebase's own signup-abuse protection (`checkUniqueEmailsPerIp`) already documents CGNAT as a reason IP-only limiting misfires in the Philippines.
- **Auto-create an account when a guest completes a Booking** — parked as a separate, unrelated decision; not part of this widget.

**Consequence:** the account-creation nudge shown in the guest widget is a fixed UI prompt (after the 2nd message), not something the model decides to say — kept out of the AI's discretion for the same reliability reason the reply tone itself is deterministic, not model-improvised.
