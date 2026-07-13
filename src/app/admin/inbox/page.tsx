import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { createGuestInboxStore } from '@/lib/inbox/guestStore'
import { isUnreviewedBotReply } from '@/lib/inbox/review'
import { inboxCopy } from '@/content/inbox'
import { AdminThread } from './AdminThread'
import { AdminGuestThread } from './AdminGuestThread'

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; tab?: string }>
}) {
  const { user } = await requireAdmin()
  const { c, tab: tabParam } = await searchParams
  const tab = tabParam === 'leads' ? 'leads' : 'customers'
  const supabase = await createClient()
  const store = createInboxStore(supabase)
  const guestStore = createGuestInboxStore(supabase)

  const [conversations, needsReply, leads] = await Promise.all([
    store.listConversations(),
    store.listConversationsNeedingReply(),
    guestStore.listLeadsWithConversations(),
  ])
  const leadsNeedingReply = leads.filter(l => l.conversationStatus === 'awaiting_merchant').length

  const { data: presence } = await supabase
    .from('merchant_presence')
    .select('online')
    .eq('merchant_id', user.id)
    .maybeSingle()

  const tabButtonClass = (active: boolean) =>
    [
      'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
      active ? 'bg-accent text-black' : 'text-text-muted hover:bg-surface',
    ].join(' ')

  return (
    <main className="mx-auto flex h-[calc(100vh-6rem)] max-w-6xl gap-4 px-4 py-6">
      <aside className="w-72 shrink-0 overflow-y-auto rounded-2xl border border-border">
        <h1 className="border-b border-border p-3 font-display text-lg text-text-primary">
          {inboxCopy.admin.title}
        </h1>

        <div className="flex gap-1 border-b border-border p-2">
          <Link href="/admin/inbox?tab=customers" className={tabButtonClass(tab === 'customers')}>
            Customers
          </Link>
          <Link href="/admin/inbox?tab=leads" className={tabButtonClass(tab === 'leads')}>
            Leads{leadsNeedingReply > 0 ? ` (${leadsNeedingReply})` : ''}
          </Link>
        </div>

        {tab === 'customers' ? (
          <CustomerList conversations={conversations} needsReply={needsReply} selected={c ?? null} />
        ) : (
          <LeadList leads={leads} selected={c ?? null} />
        )}
      </aside>

      <section className="flex-1 overflow-hidden rounded-2xl border border-border">
        {tab === 'customers' ? (
          <CustomerThread store={store} c={c} conversations={conversations} needsReply={needsReply} online={presence?.online ?? false} />
        ) : (
          <LeadThread guestStore={guestStore} c={c} leads={leads} />
        )}
      </section>
    </main>
  )
}

function CustomerList({
  conversations,
  needsReply,
  selected,
}: {
  conversations: Awaited<ReturnType<ReturnType<typeof createInboxStore>['listConversations']>>
  needsReply: Awaited<ReturnType<ReturnType<typeof createInboxStore>['listConversationsNeedingReply']>>
  selected: string | null
}) {
  const activeSelected = selected ?? needsReply[0]?.id ?? conversations[0]?.id ?? null
  if (conversations.length === 0) {
    return <p className="p-3 text-text-muted">{inboxCopy.admin.listEmpty}</p>
  }
  return (
    <ul>
      {needsReply.length > 0 && (
        <>
          <li className="border-b border-border bg-surface/50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Needs Reply</p>
          </li>
          {needsReply.map(conv => (
            <li key={conv.id}>
              <Link
                href={`/admin/inbox?tab=customers&c=${conv.id}`}
                className={[
                  'block border-b border-border px-3 py-2 text-text-primary hover:bg-surface',
                  conv.id === activeSelected ? 'bg-accent/10' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between">
                  <span className="font-medium">{conv.customer_name ?? 'Customer'}</span>
                  <span className="ml-2 shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-black">reply</span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-text-secondary">{conv.lastCustomerMessage}</p>
              </Link>
            </li>
          ))}
        </>
      )}
      {needsReply.length > 0 && conversations.length > needsReply.length && (
        <li className="border-b border-border bg-surface/50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">All Conversations</p>
        </li>
      )}
      {conversations
        .filter(conv => !needsReply.some(nr => nr.id === conv.id))
        .map(conv => (
          <li key={conv.id}>
            <Link
              href={`/admin/inbox?tab=customers&c=${conv.id}`}
              className={[
                'block border-b border-border px-3 py-2 text-text-primary hover:bg-surface',
                conv.id === activeSelected ? 'bg-surface' : '',
              ].join(' ')}
            >
              <span className="font-medium">{conv.customer_name ?? 'Customer'}</span>
              {conv.status === 'awaiting_merchant' && (
                <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-black">new</span>
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
  )
}

function LeadList({
  leads,
  selected,
}: {
  leads: Awaited<ReturnType<ReturnType<typeof createGuestInboxStore>['listLeadsWithConversations']>>
  selected: string | null
}) {
  const activeSelected = selected ?? leads[0]?.guest_conversation_id ?? null
  if (leads.length === 0) {
    return <p className="p-3 text-text-muted">No leads yet.</p>
  }
  return (
    <ul>
      {leads.map(lead => (
        <li key={lead.id}>
          <Link
            href={`/admin/inbox?tab=leads&c=${lead.guest_conversation_id ?? ''}`}
            className={[
              'block border-b border-border px-3 py-2 text-text-primary hover:bg-surface',
              lead.guest_conversation_id === activeSelected ? 'bg-surface' : '',
            ].join(' ')}
          >
            <div className="flex items-start justify-between">
              <span className="font-medium">{lead.name}</span>
              {lead.conversationStatus === 'awaiting_merchant' && (
                <span className="ml-2 shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-black">reply</span>
              )}
            </div>
            <p className="text-sm text-text-muted">{lead.email}</p>
            {lead.lastMessageBody && (
              <p className="mt-1 line-clamp-1 text-sm text-text-secondary">{lead.lastMessageBody}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

async function CustomerThread({
  store,
  c,
  conversations,
  needsReply,
  online,
}: {
  store: ReturnType<typeof createInboxStore>
  c?: string
  conversations: Awaited<ReturnType<ReturnType<typeof createInboxStore>['listConversations']>>
  needsReply: Awaited<ReturnType<ReturnType<typeof createInboxStore>['listConversationsNeedingReply']>>
  online: boolean
}) {
  const selected = c ?? needsReply[0]?.id ?? conversations[0]?.id ?? null
  if (!selected) return <p className="p-4 text-text-muted">{inboxCopy.admin.listEmpty}</p>

  const messages = await store.listMessages(selected)
  await store.markRead(selected, 'merchant')
  await store.markReviewedByAdmin(selected)

  return <AdminThread conversationId={selected} initial={messages} online={online} />
}

async function LeadThread({
  guestStore,
  c,
  leads,
}: {
  guestStore: ReturnType<typeof createGuestInboxStore>
  c?: string
  leads: Awaited<ReturnType<ReturnType<typeof createGuestInboxStore>['listLeadsWithConversations']>>
}) {
  const selectedConvoId = c ?? leads[0]?.guest_conversation_id ?? null
  const lead = leads.find(l => l.guest_conversation_id === selectedConvoId)
  if (!selectedConvoId || !lead) return <p className="p-4 text-text-muted">No leads yet.</p>

  const messages = await guestStore.listGuestMessages(selectedConvoId)

  return (
    <AdminGuestThread
      guestConversationId={selectedConvoId}
      leadName={lead.name}
      leadEmail={lead.email}
      leadPhone={lead.phone}
      initial={messages}
    />
  )
}
