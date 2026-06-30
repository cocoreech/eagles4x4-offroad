'use client'

import { useTransition } from 'react'
import type { ConversationMessage } from '@/types/inbox'
import { InboxThread } from '@/app/inbox/InboxThread'
import { inboxCopy } from '@/content/inbox'
import { sendMerchantMessage, setPresence } from './actions'

interface Props {
  conversationId: string
  initial: ConversationMessage[]
  online: boolean
}

export function AdminThread({ conversationId, initial, online }: Props) {
  const [pending, startTransition] = useTransition()

  function togglePresence() {
    const fd = new FormData()
    fd.set('online', online ? 'false' : 'true')
    startTransition(() => {
      void setPresence(fd)
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-2">
        <button
          type="button"
          onClick={togglePresence}
          disabled={pending}
          aria-pressed={online}
          className="rounded-lg border border-border px-3 py-1 text-sm text-text-primary disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {online ? inboxCopy.admin.online : inboxCopy.admin.offline}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <InboxThread
          conversationId={conversationId}
          initial={initial}
          isAdmin
          onSend={sendMerchantMessage}
        />
      </div>
    </div>
  )
}
