import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { isUnreviewedBotReply } from '@/lib/inbox/review'
import { inboxCopy } from '@/content/inbox'
import { AdminThread } from './AdminThread'

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { user } = await requireAdmin()
  const { c } = await searchParams
  const supabase = await createClient()
  const store = createInboxStore(supabase)
  const conversations = await store.listConversations()

  const selected = c ?? conversations[0]?.id ?? null
  const messages = selected ? await store.listMessages(selected) : []
  if (selected) {
    await store.markRead(selected, 'merchant')
    await store.markReviewedByAdmin(selected)
    const reviewedIdx = conversations.findIndex(c => c.id === selected)
    if (reviewedIdx !== -1) {
      conversations[reviewedIdx] = { ...conversations[reviewedIdx], admin_reviewed_at: new Date().toISOString() }
    }
  }

  const { data: presence } = await supabase
    .from('merchant_presence')
    .select('online')
    .eq('merchant_id', user.id)
    .maybeSingle()

  return (
    <main className="mx-auto flex h-[calc(100vh-6rem)] max-w-6xl gap-4 px-4 py-6">
      <aside className="w-72 shrink-0 overflow-y-auto rounded-2xl border border-border">
        <h1 className="border-b border-border p-3 font-display text-lg text-text-primary">
          {inboxCopy.admin.title}
        </h1>
        {conversations.length === 0 && (
          <p className="p-3 text-text-muted">{inboxCopy.admin.listEmpty}</p>
        )}
        <ul>
          {conversations.map(conv => (
            <li key={conv.id}>
              <Link
                href={`/admin/inbox?c=${conv.id}`}
                className={[
                  'block border-b border-border px-3 py-2 text-text-primary hover:bg-surface',
                  conv.id === selected ? 'bg-surface' : '',
                ].join(' ')}
              >
                <span className="font-medium">{conv.customer_name ?? 'Customer'}</span>
                {conv.status === 'awaiting_merchant' && (
                  <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-black">
                    new
                  </span>
                )}
                {isUnreviewedBotReply(conv) && (
                  <span className="ml-2 rounded-full border border-accent px-2 py-0.5 text-xs text-accent">
                    🤖 review
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 overflow-hidden rounded-2xl border border-border">
        {selected ? (
          <AdminThread
            conversationId={selected}
            initial={messages}
            online={presence?.online ?? false}
          />
        ) : (
          <p className="p-4 text-text-muted">{inboxCopy.admin.listEmpty}</p>
        )}
      </section>
    </main>
  )
}
