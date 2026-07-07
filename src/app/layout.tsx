// ============================================================
// Root layout — loads self-hosted variable fonts + global styles
// ============================================================

import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display, Rajdhani } from 'next/font/google'
import { brand as brandConfig } from '@/content/brand'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import InstallAppButton from '@/components/InstallAppButton'
import PageViewTracker from '@/components/PageViewTracker'
import './globals.css'

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  style: ['normal', 'italic'],
  weight: ['400', '700', '900'],
})

const brandFont = Rajdhani({
  subsets: ['latin'],
  variable: '--font-brand',
  display: 'swap',
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: brandConfig.name_full,
  description: brandConfig.description,
  metadataBase: new URL(brandConfig.site_url),
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Eagles 4x4' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#D4A017',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${brandFont.variable}`}
    >
      <body>
        {children}
        <ServiceWorkerRegister />
        <InstallAppButton />
        <PageViewTracker />
      </body>
    </html>
  )
}
