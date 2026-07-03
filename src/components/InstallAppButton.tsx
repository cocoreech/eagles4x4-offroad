'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!deferred) return null

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt()
        setDeferred(null)
      }}
      className="fixed bottom-4 right-4 z-50 rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] shadow-lg print:hidden"
      style={{ background: 'var(--color-accent)', color: '#000' }}
    >
      Install app
    </button>
  )
}
