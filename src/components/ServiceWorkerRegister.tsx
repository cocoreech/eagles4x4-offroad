'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    // Never register in dev: Turbopack serves JS chunks under stable
    // filenames across recompiles, so the SW's cache-first strategy for
    // /_next/static/* would serve stale bundles forever and mask every
    // code change behind a false "nothing happened." Production builds
    // get fresh hashed filenames per build, so this only matters locally.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const reg of regs) reg.unregister()
      })
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('[sw] registration failed', err)
    })
  }, [])
  return null
}
