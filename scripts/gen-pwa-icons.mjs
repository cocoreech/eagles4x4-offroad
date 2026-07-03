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
