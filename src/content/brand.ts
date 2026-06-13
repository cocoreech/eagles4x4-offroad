// ============================================================
// Brand identity — swappable configuration for templates
// ============================================================

export const brand = {
  // Core identity
  name: 'Eagles',
  name_full: 'Eagles 4×4 Offroad',
  tagline: "by 4×4 owners, for 4×4 owners",

  // SEO & metadata
  description: "Cavite's premier 4×4 workshop. Lift kits, suspension, bull bars, and full builds.",
  site_url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',

  // Contact
  location: 'Dasmariñas, Cavite',
  phone: '0917 XXX XXXX',
  email: 'hello@eagles4x4.ph',
  hours: 'Mon–Sat, 8AM–6PM',

  // Imagery & assets
  logo: '/images/eagles4x4-logo.jpg',
  logo_alt: 'Eagles 4×4 logo',

  // Brand narrative
  story: "Eagles 4×4 Offroad is more than a shop. We're part of The Fraternal Order of Eagles — a collective of 4×4 enthusiasts dedicated to the craft.",
  story_location: "Based in Dasmariñas, Cavite, we specialize in 4×4 builds, lift kits, suspension, and bull bars for the Philippine offroad community.",

  // Footer
  copyright: '© 2026 Eagles 4×4 Offroad. All rights reserved.',

  // Organization
  organization: 'The Fraternal Order of Eagles',
  organization_logo: '/images/tfoe-logo.jpg',
  organization_logo_alt: 'TFOE Philippine Eagles Logo',
} as const
