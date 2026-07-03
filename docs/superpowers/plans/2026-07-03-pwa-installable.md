# Installable PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`). This feature is verified at runtime (build + Lighthouse + manual install), not vitest.

**Goal:** Make the site an installable PWA — manifest wired in, real PNG icons, a hand-rolled service worker with an offline fallback, and an Install button.

**Architecture:** Icons generated from the logo via `sharp`; `manifest.json` + `layout.tsx` metadata make it installable; a zero-dep `public/sw.js` caches the app shell + serves `offline.html`; a client component registers it.

**Tech Stack:** Next.js 16, TypeScript, `sharp` (already installed) for a one-off icon build. **No new dependencies.**

**Spec:** [docs/superpowers/specs/2026-07-03-pwa-installable-design.md](../specs/2026-07-03-pwa-installable-design.md).

## Global Constraints
- **No new dependencies.**
- SW must **never cache** Supabase/API/auth requests.
- Guard `'serviceWorker' in navigator`; registration never throws.
- Merge into existing `layout.tsx` `metadata`/`viewport` exports (don't duplicate).

---

## Task 1: Generate PWA icons

**Files:** Create `scripts/gen-pwa-icons.mjs`; generate `public/icons/*.png`.

- [ ] **Step 1:** Create `scripts/gen-pwa-icons.mjs`:

```js
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = 'public/images/eagles-logo.jpg'
const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

const bg = { r: 12, g: 13, b: 10, alpha: 1 } // #0C0D0A

await sharp(SRC).resize(192, 192, { fit: 'cover' }).png().toFile(`${OUT}/icon-192.png`)
await sharp(SRC).resize(512, 512, { fit: 'cover' }).png().toFile(`${OUT}/icon-512.png`)
await sharp(SRC).resize(180, 180, { fit: 'cover' }).png().toFile(`${OUT}/apple-touch-icon.png`)

// Maskable: logo at ~80% on a solid safe-zone background.
const inner = await sharp(SRC).resize(410, 410, { fit: 'contain', background: bg }).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: bg } })
  .composite([{ input: inner, gravity: 'centre' }])
  .png()
  .toFile(`${OUT}/icon-maskable-512.png`)

console.log('PWA icons generated in', OUT)
```

- [ ] **Step 2:** Run it: `node scripts/gen-pwa-icons.mjs` → confirm 4 PNGs in `public/icons/`.
- [ ] **Step 3: Commit** — `git add scripts/gen-pwa-icons.mjs public/icons && git commit -m "feat(pwa): generate app icons from logo"`

---

## Task 2: Manifest + layout wiring + SW registration

**Files:** Modify `public/manifest.json`, `src/app/layout.tsx`; Create `src/components/ServiceWorkerRegister.tsx`.

- [ ] **Step 1:** Update `public/manifest.json` `icons` to the PNGs + add `shortcuts` (see spec §4).
- [ ] **Step 2:** Create `src/components/ServiceWorkerRegister.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('[sw] registration failed', err)
    })
  }, [])
  return null
}
```

- [ ] **Step 3:** In `src/app/layout.tsx`, merge into the existing `metadata` export: `manifest: '/manifest.json'`, `appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Eagles 4x4' }`, `icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' }`. Merge into (or add) `export const viewport = { themeColor: '#D4A017' }`. Render `<ServiceWorkerRegister />` inside `<body>`.
- [ ] **Step 4:** `npx tsc --noEmit && npx eslint src/components/ServiceWorkerRegister.tsx src/app/layout.tsx` → clean. **Commit** — `feat(pwa): wire manifest + icons + SW registration into layout`.

---

## Task 3: Service worker + offline page

**Files:** Create `public/sw.js`, `public/offline.html`.

- [ ] **Step 1:** Create `public/offline.html` — standalone branded page:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline · Eagles 4x4</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
      background:#0C0D0A; color:#F5F5F5; font-family:system-ui,sans-serif; text-align:center; padding:24px; }
    img { width:96px; height:96px; border-radius:16px; margin-bottom:20px; }
    h1 { font-size:20px; margin:0 0 8px; color:#D4A017; }
    p { color:#999; max-width:320px; line-height:1.6; }
  </style>
</head>
<body>
  <img src="/icons/icon-192.png" alt="Eagles 4x4" />
  <h1>You're offline</h1>
  <p>Reconnect to the internet to keep browsing Eagles 4x4. Your booking and chat need a connection.</p>
</body>
</html>
```

- [ ] **Step 2:** Create `public/sw.js`:

```js
const VERSION = 'eagles4x4-v1'
const PRECACHE = ['/offline.html', '/icons/icon-192.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/') || url.pathname.startsWith('/_next/static/')
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // never touch Supabase/cross-origin

  // Page navigations: network-first, offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }

  // Static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(cached => cached ?? fetch(request).then(resp => {
        const copy = resp.clone()
        caches.open(VERSION).then(c => c.put(request, copy))
        return resp
      })),
    )
    return
  }
  // Everything else (API/auth/etc.): default network, no caching.
})
```

- [ ] **Step 3: Commit** — `git add public/sw.js public/offline.html && git commit -m "feat(pwa): service worker (offline fallback + static cache) + offline page"`

---

## Task 4: Install button

**Files:** Create `src/components/InstallAppButton.tsx`; render in `layout.tsx`.

- [ ] **Step 1:** Create `src/components/InstallAppButton.tsx`:

```tsx
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
      onClick={async () => { await deferred.prompt(); setDeferred(null) }}
      className="fixed bottom-4 right-4 z-50 rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] shadow-lg print:hidden"
      style={{ background: 'var(--color-accent)', color: '#000' }}
    >
      Install app
    </button>
  )
}
```

- [ ] **Step 2:** Render `<InstallAppButton />` in `src/app/layout.tsx` `<body>` (next to `ServiceWorkerRegister`).
- [ ] **Step 3:** `npx tsc --noEmit && npx eslint src/components/InstallAppButton.tsx` → clean. **Commit** — `feat(pwa): custom Install app button`.

---

## Task 5: Verify

- [ ] `npm run test` (existing suite unaffected) + `npx tsc --noEmit && npm run lint && npm run build` → clean.
- [ ] `npm run dev` → visit `/manifest.json`, `/sw.js`, `/offline.html`, `/icons/icon-192.png` (all 200).
- [ ] Chrome DevTools → Application → Manifest (no errors, icons show) → Lighthouse "Installable" passes; test install + offline navigation.
- [ ] `git push origin feat/touchpoints`.

---

## Self-Review
**Spec coverage:** §3 icons — T1 ✓; §4 manifest — T2 ✓; §5 layout — T2 ✓; §6 SW — T3 ✓; §7 offline — T3 ✓; §8 register+install — T2/T4 ✓; §9 verify — T5 ✓.
**Placeholder scan:** all code complete.
**Type consistency:** `ServiceWorkerRegister`/`InstallAppButton` are self-contained client components; no cross-task type dependencies.
