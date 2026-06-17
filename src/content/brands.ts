// Brand partners — displayed in the scrolling logo strip.
// Add/remove entries here; the marquee component picks them up automatically.

export type Brand = {
  name: string
  abbr: string  // short label shown when no logo image is available
  logo?: string // path under /public — optional, falls back to text chip
  url?: string  // external brand site, opens in new tab
}

export const BRAND_PARTNERS: Brand[] = [
  { name: 'ARB 4x4 Accessories',  abbr: 'ARB',         logo: '/images/brands/arb.png',          url: 'https://www.arb.com.au' },
  { name: 'BFGoodrich Tires',     abbr: 'BFGOODRICH',  logo: '/images/brands/bfgoodrich.png',   url: 'https://www.bfgoodrichtires.com' },
  { name: 'Toyo Tires',           abbr: 'TOYO',        logo: '/images/brands/toyo.svg',          url: 'https://www.toyotires.com' },
  { name: 'Ironman 4×4',          abbr: 'IRONMAN',     logo: '/images/brands/ironman.webp',      url: 'https://www.ironman4x4.com' },
  { name: 'Maxxis Tires',         abbr: 'MAXXIS',      logo: '/images/brands/maxxis.png',        url: 'https://www.maxxis.com' },
  { name: 'Fuel Off-Road',        abbr: 'FUEL',        logo: '/images/brands/fuel-wheels.png',   url: 'https://www.fueloffroad.com' },
  { name: 'Würth',                abbr: 'WÜRTH',       logo: '/images/brands/wurth.png',         url: 'https://www.wurth.com' },
  { name: 'Old Man Emu',          abbr: 'OME',                                                    url: 'https://www.arb.com.au/ome' },
  { name: 'Black Rhino Wheels',   abbr: 'BLACK RHINO',                                            url: 'https://www.blackrhinowheels.com' },
  { name: 'Profender Suspension',  abbr: 'PROFENDER' },
  { name: 'Amsoil',               abbr: 'AMSOIL',                                                 url: 'https://www.amsoil.com' },
  { name: 'Totachi',              abbr: 'TOTACHI',                                                url: 'https://www.totachi.com' },
  { name: 'Mountain Top',         abbr: 'MTN TOP' },
  { name: 'Tuff Lids',            abbr: 'TUFF LIDS' },
  { name: 'XBRI Tires',           abbr: 'XBRI' },
  { name: 'Wideway',              abbr: 'WIDEWAY' },
  { name: 'Radar Tires',          abbr: 'RADAR',                                                  url: 'https://www.radartires.com' },
  { name: 'VU Wheels',            abbr: 'VU WHEELS' },
  { name: 'Black Mamba',          abbr: 'BLK MAMBA' },
  { name: 'Keko',                 abbr: 'KEKO' },
  { name: 'Roller Lid',           abbr: 'ROLLER LID' },
  { name: 'Rage',                 abbr: 'RAGE' },
]
