// Brand partners — displayed in the scrolling logo strip.
// Add/remove entries here; the marquee component picks them up automatically.

export type Brand = {
  name: string
  abbr: string  // short label shown when no logo image is available
  logo?: string // path under /public — optional, falls back to text chip
}

export const BRAND_PARTNERS: Brand[] = [
  { name: 'ARB 4x4 Accessories',  abbr: 'ARB',         logo: '/images/brands/arb.png' },
  { name: 'BFGoodrich Tires',     abbr: 'BFGOODRICH',  logo: '/images/brands/bfgoodrich.png' },
  { name: 'Toyo Tires',           abbr: 'TOYO',        logo: '/images/brands/toyo.svg' },
  { name: 'Ironman 4×4',          abbr: 'IRONMAN',     logo: '/images/brands/ironman.webp' },
  { name: 'Maxxis Tires',         abbr: 'MAXXIS',      logo: '/images/brands/maxxis.png' },
  { name: 'Fuel Off-Road',        abbr: 'FUEL',        logo: '/images/brands/fuel-wheels.png' },
  { name: 'Würth',                abbr: 'WÜRTH',       logo: '/images/brands/wurth.png' },
  { name: 'Profender Suspension',  abbr: 'PROFENDER',   logo: '/images/brands/profender.png' },
  { name: 'Old Man Emu',          abbr: 'OME' },
  { name: 'Black Rhino Wheels',   abbr: 'BLACK RHINO' },
  { name: 'Amsoil',               abbr: 'AMSOIL' },
  { name: 'Totachi',              abbr: 'TOTACHI' },
  { name: 'Mountain Top',         abbr: 'MTN TOP' },
  { name: 'Tuff Lids',            abbr: 'TUFF LIDS' },
  { name: 'XBRI Tires',           abbr: 'XBRI' },
  { name: 'Wideway',              abbr: 'WIDEWAY' },
  { name: 'Radar Tires',          abbr: 'RADAR' },
  { name: 'VU Wheels',            abbr: 'VU WHEELS' },
  { name: 'Black Mamba',          abbr: 'BLK MAMBA' },
  { name: 'Keko',                 abbr: 'KEKO' },
  { name: 'Roller Lid',           abbr: 'ROLLER LID' },
  { name: 'Rage',                 abbr: 'RAGE' },
]
