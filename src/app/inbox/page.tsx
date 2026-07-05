import Link from 'next/link'
import { requireConfirmed } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { inboxCopy } from '@/content/inbox'
import { InboxThread } from './InboxThread'

export default async function InboxPage() {
  const user = await requireConfirmed()
  const supabase = await createClient()
  const store = createInboxStore(supabase)
  const convo = await store.getOrCreateConversation(user.id)
  const messages = await store.listMessages(convo.id)
  await store.markRead(convo.id, 'customer')

  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-6">
      <header className="mb-4">
        <Link href="/" className="inline-block mb-3 text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>← Home</Link>
        <h1 className="font-display text-2xl leading-[1.15] text-text-primary">{inboxCopy.title}</h1>
        <p className="text-text-muted">{inboxCopy.subtitle}</p>
      </header>
      <div className="flex-1 overflow-hidden rounded-2xl border border-border bg-bg">
        <InboxThread conversationId={convo.id} initial={messages} />
      </div>
    </main>
  )
}
