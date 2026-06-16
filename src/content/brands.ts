// Brand partners — displayed in the scrolling logo strip.
// Add/remove entries here; the marquee component picks them up automatically.

export type Brand = {
  name: string
  abbr: string  // short label shown when no logo image is available
  logo?: string // path under /images/brands/ — optional, falls back to text
  url?: string  // external brand site, opens in new tab
}

export const BRAND_PARTNERS: Brand[] = [
  { name: 'ARB 4x4 Accessories', abbr: 'ARB'       },
  { name: 'KYB Shocks',          abbr: 'KYB'       },
  { name: 'Dobinsons',           abbr: 'DOBINSONS'  },
  { name: 'Ironman 4×4',         abbr: 'IRONMAN'   },
  { name: 'WARN Industries',     abbr: 'WARN'      },
  { name: 'BFGoodrich Tires',    abbr: 'BFGOODRICH' },
  { name: 'Maxxis Tires',        abbr: 'MAXXIS'    },
  { name: 'OX Wheels',           abbr: 'OX WHEELS'  },
  { name: 'STEDI Lighting',      abbr: 'STEDI'     },
  { name: 'Rhino-Rack',          abbr: 'RHINO-RACK' },
  { name: 'Safari ARB',          abbr: 'SAFARI'    },
  { name: 'Factor 55',           abbr: 'FACTOR 55'  },
]
