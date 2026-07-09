# AI Concierge replies autonomously; wrong answers are caught after the fact, not gated before send

**Status:** accepted

The AI Concierge's core value is instant reply when no merchant is online (see [CONTEXT.md](../../CONTEXT.md)) — it only ever fires in exactly the situation where a human isn't available to gate it, so requiring admin approval before every send would silently reintroduce the wait the feature exists to remove. We decided against a pre-send review step. Instead: the Concierge keeps sending fully autonomously; detection of a wrong-but-confident reply (one the model didn't itself flag via `needs_human`) happens after the fact, via an "unreviewed bot reply" badge admin skims on the existing `/admin/inbox` conversation list; correction happens by a human joining that same thread and posting a follow-up — there is no retraction of an already-sent message, only a human correction visible in context.

**Considered and rejected:**
- **Require admin approval before every send** — defeats the Concierge's purpose; it only replies when no merchant is online, so gating the send on a human reintroduces exactly the wait it exists to remove.
- **Only flag promo/pricing-topic replies for review** — too narrow; a wrong answer on stock, hours, or services would go uncaught.
- **Customer-facing "this isn't right" flag as the sole mechanism** — relies on the customer noticing and bothering to flag it; doesn't catch a wrong answer that just goes unquestioned.

**Consequence:** the trust boundary here is "grounding + escalation rules prevent most bad answers up front, admin spot-checks catch what slips through" — not "nothing reaches the customer unreviewed." Anyone extending the Concierge's grounding (e.g. widening it to more topics) should weigh that a wider grounding scope is a wider surface for confidently-wrong answers that only get caught on the next admin skim, not before the customer sees them.
