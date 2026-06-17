# Hybrid delivery for booking Touchpoints (auto-email + manual click-to-chat)

Touchpoints (booking reminders and post-service follow-ups — see [CONTEXT.md › Touchpoint](../../CONTEXT.md)) are delivered through a **hybrid** model: the daily engine **auto-sends by email** where the customer has an email, and otherwise surfaces the message in an admin queue for staff to send via **one-tap click-to-chat** (WhatsApp / SMS / Call deep links that open the chat app pre-filled). We chose this over fully-automated chat delivery because true programmatic sending through WhatsApp/Viber/Messenger is gated behind paid Business APIs (Meta/Viber verification + per-message fees), whereas email auto-send is free and click-to-chat is free + works for guests who left only a phone number.

## Status

accepted

## Consequences

- **The send step is a channel adapter, not a hardcoded path.** `email` is implemented (Resend); `sms` and `whatsapp` ship as stubs behind the same interface. Enabling paid auto-send later is an adapter swap + config, not a rebuild. This is deliberate so a future reader understands why empty SMS/WhatsApp adapters exist before any paid integration.
- **"Sent" means different things per channel, and the UI must say so.** Email `sent` is provider-confirmed (Resend). Chat `sent` is **staff-attested** — we cannot confirm a human actually hit send or that WhatsApp delivered it. The admin log labels chat sends as "marked sent by <staff>" to avoid implying delivery proof.
- **`replied` / `no_response` are manual labels in MVP.** Replies arrive over channels we cannot read for free, so there is no signal to auto-detect them. Reply-detection is explicitly Phase 2 (rides on the paid inbound webhooks below), not a cut feature.
- **Auto-email carries a mandatory unsubscribe.** The moment we auto-send, deliverability and etiquette require an opt-out. Emails include an unsubscribe link → a suppression list keyed by email (works for guests) → the engine skips suppressed addresses. Chat needs no equivalent (staff judgment).
- **Phase 2 is client-funded automation.** Paid SMS (Semaphore, ~₱0.50–0.80/msg) and/or WhatsApp Business API (~₱1–3/conversation + possible BSP minimum) turn one-tap chat into true auto-send and unlock reply-detection. Rough small-shop estimate ~₱200–1,000/mo; pitched to the client as an upgrade once the free hybrid is demoed.

## Considered options

- **Fully automated chat now (WhatsApp Business API / SMS)** — best engagement and zero staff effort, but per-message cost, Meta/Viber verification, and template-approval friction we don't want to gamble dev time on before the client funds it. Deferred to Phase 2 behind the adapter seam.
- **All-manual click-to-chat (no auto-email)** — simplest and fully free, but every reminder needs a human tap even for customers who'd happily get an email; rejected because free auto-email removes most of that toil.
- **Static template files in `src/content/`** — rejected for message templates because admins must edit wording at runtime without a deploy; templates are DB-backed instead.

## Note on the demo

The free hybrid demos end-to-end today: auto-email works against the owner's own inbox without a verified domain, and the click-to-chat queue works fully offline. The verified sending domain (deferred Task 6) and any paid channel are go-live / Phase-2 concerns, not demo blockers.
