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

---

## Update (2026-07-11): same-browser claim on signup

The "no auto-claim" position above is **partially reversed.** We now migrate a guest's chat history into their new account's Inbox on signup — but keyed on the **guest session cookie (same browser only), not email.** The email-keyed auto-claim originally considered stays rejected.

Why the reversal: the widget actively nudges guests to create an account (that's the lead play), so guests returning to sign up is now the *intended* path, not a hypothetical — which removes the "before there's evidence guests return" objection. Dropping the just-typed conversation on signup is a visibly bad experience precisely for the users we're steering hardest.

Why cookie, not email: email-matching would attach a shared or public computer's guest chat to whoever signs up next on that machine — a real privacy leak. The session cookie proves it's the same browser that actually held the conversation. This is deliberately *different* from how guest **Bookings** link (by email): a booking carries the person's own verified contact info; an anonymous chat does not, so the browser is the only trustworthy link. If the guest signs up from a different device or clears cookies first, the chat simply stays anonymous and the new Inbox starts empty — an acceptable miss, not a leak.

The claim runs best-effort in the same sign-in path as `linkGuestBookings` (`/auth/callback` and OTP verify), copies `guest_messages` into `conversation_messages` (guest→customer, bot→bot, timestamps preserved), marks any captured Lead converted, deletes the guest record, and clears the spent cookie.
