# Installable PWA (Design)

**Date:** 2026-07-03
**Status:** approved (brainstorm) — pending spec review
**Related:** `public/manifest.json` (exists, unwired), `src/app/layout.tsx`, `public/images/eagles-logo.jpg`

## 1. Summary

Turn the site into a real **installable PWA**: browsers can "Install app" / "Add to Home Screen" and it opens full-screen like a native app. Today only a `manifest.json` exists — it's **not linked in the layout**, there are **no proper icons**, and there's **no service worker** (which Chrome requires to offer install). This adds all three, zero new dependencies, with a hand-rolled service worker and an offline fallback. Real-time data still needs network (correct for a booking/chat app).

## 2. Scope

**In scope (MVP = installable + offline fallback):**
- Generate proper PNG icons from the existing logo (via `sharp`, already available).
- Wire the manifest + icons + theme-color + iOS meta into `layout.tsx`.
- A zero-dependency `public/sw.js` (install/activate/fetch) + `public/offline.html` fallback.
- A `ServiceWorkerRegister` client component in the layout.
- A lightweight custom **"Install app"** button (listens for `beforeinstallprompt`).
- App shortcuts in the manifest (Book Now, Admin).

**Out of scope (future):**
- Runtime page caching for offline *browsing* (#3) — the SW is structured so this is a later drop-in (network-first) in the same fetch handler.
- Separate customer vs admin installs — one installable app + an Admin shortcut instead.
- Push notifications (separate feature).

## 3. Icons

A one-off Node script (`scripts/gen-pwa-icons.mjs`, run once with `sharp`) produces from `public/images/eagles-logo.jpg`:
- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)
- `public/icons/icon-maskable-512.png` (512×512, logo centered on a `#0C0D0A` background with ~10% safe-zone padding)
- `public/icons/apple-touch-icon.png` (180×180)

The generated PNGs are committed as assets.

## 4. Manifest (`public/manifest.json`)

Keep `name`, `short_name`, `description`, `start_url: "/"`, `display: "standalone"`, `background_color: "#0C0D0A"`, `theme_color: "#D4A017"`, `orientation: "portrait"`. Replace the JPG icon entries with the PNGs:
```
"icons": [
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
],
"shortcuts": [
  { "name": "Book a service", "url": "/bookings/new" },
  { "name": "Admin", "url": "/admin" }
]
```

## 5. Layout wiring (`src/app/layout.tsx`)

Add to the exported `metadata`:
```
manifest: '/manifest.json',
appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Eagles 4x4' },
icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
```
Add/extend the `viewport` export: `themeColor: '#D4A017'`. Render `<ServiceWorkerRegister />` once in the body. (Merge with any existing `metadata`/`viewport` exports rather than duplicating.)

## 6. Service worker (`public/sw.js`, plain JS)

- **`install`:** open a versioned cache (`eagles4x4-v1`), precache `['/offline.html', core icons]`, `skipWaiting()`.
- **`activate`:** delete caches not matching the current version; `clients.claim()`.
- **`fetch`** (only handle GET, same-origin):
  - **Navigations** (`request.mode === 'navigate'`): network-first; on failure return the cached `/offline.html`.
  - **Static assets** (`/icons/`, `/images/`, `/_next/static/`): cache-first, then network + cache.
  - **Everything else** (Supabase, `/api`, auth, cross-origin): pass through to network, **never cache**.
- Bump the cache version string to release SW changes.

## 7. Offline page (`public/offline.html`)

A standalone branded HTML page (no framework) — dark background, logo, "You're offline. Reconnect to keep browsing." Precached in step 6.

## 8. Registration + install button

- `src/components/ServiceWorkerRegister.tsx` (`'use client'`): on mount, if `'serviceWorker' in navigator`, `register('/sw.js')`; log failures, never throw.
- `src/components/InstallAppButton.tsx` (`'use client'`): capture the `beforeinstallprompt` event, show an "Install app" button that calls `prompt()`; hide once installed or if the event never fires (browser handles install natively regardless). Placed unobtrusively (e.g. bottom corner or in the nav).

## 9. Testing / verification

Browser-runtime feature — verified by:
- `npm run build` clean; `next` serves `/manifest.json`, `/sw.js`, `/offline.html`, and the icons (200).
- Chrome DevTools → **Application → Manifest** shows the icons/no errors; **Lighthouse → "Installable"** passes.
- Manual: the install prompt/`Install app` button appears; installing opens full-screen; airplane-mode a navigation → the offline page shows.

(Minimal unit-testable logic; this feature is intentionally verified at runtime, not via vitest.)

## 10. Build order

1. Generate icons (script) + commit.
2. Manifest update + layout wiring + `ServiceWorkerRegister`.
3. `sw.js` + `offline.html`.
4. `InstallAppButton`.
5. Verify (build + Lighthouse + manual install).
