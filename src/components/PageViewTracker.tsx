'use client'

// ============================================================
// PageViewTracker — fires a privacy-safe page-view beacon on route change
// ============================================================
// Mounted once in the root layout. Uses navigator.sendBeacon so it never
// blocks navigation. The /api/track route does bot filtering + hashing.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Keep in sync with SKIP_PREFIXES in /api/track — no point sending beacons
// the server will just discard.
const SKIP_PREFIXES = ['/admin', '/login', '/mfa', '/logout', '/account', '/verify']

export default function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (SKIP_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return

    try {
      const body = JSON.stringify({ path: pathname })
      if (typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
      } else {
        void fetch('/api/track', {
          method: 'POST',
          body,
          headers: { 'content-type': 'application/json' },
          keepalive: true,
        })
      }
    } catch {
      // analytics must never break the page
    }
  }, [pathname])

  return null
}
