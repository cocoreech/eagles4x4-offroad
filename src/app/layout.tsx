// ============================================================
// Root layout — loads self-hosted variable fonts + global styles
// ============================================================

import type { Metadata } from 'next'
import { Inter, Playfair_Display, Rajdhani } from 'next/font/google'
import { brand as brandConfig } from '@/content/brand'
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
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${brandFont.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
