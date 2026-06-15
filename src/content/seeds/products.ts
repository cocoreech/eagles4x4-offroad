// ============================================================
// Demo products — used when no database products exist
// ============================================================
// Seed data for services calculator. In production, the services page
// queries the database; this is a fallback for fresh instances.

export const seedProducts = [
  {
    id: 'prod-lift-kit-4',
    slug: 'lift-kit-4-inch',
    name: 'Lift Kit 4"',
    description: 'Professional 4-inch suspension lift system with custom fabrication',
    category: 'Suspension',
    starting_price: 45000,
    image_url: '/images/product-lift-kit.jpg',
    icon: 'Gauge',
  },
  {
    id: 'prod-bull-bar',
    slug: 'arb-bull-bar',
    name: 'ARB Bull Bar',
    description: 'Heavy-duty front bull bar with integrated winch mounting',
    category: 'Protection',
    starting_price: 28000,
    image_url: '/images/product-bull-bar.jpg',
    icon: 'Shield',
  },
  {
    id: 'prod-suspension-overhaul',
    slug: 'suspension-complete-overhaul',
    name: 'Suspension Overhaul',
    description: 'Complete suspension system rebuild with premium components',
    category: 'Suspension',
    starting_price: 85000,
    image_url: '/images/product-suspension.jpg',
    icon: 'Gauge',
  },
  {
    id: 'prod-winch',
    slug: 'warn-powersports-winch',
    name: 'Warn Winch System',
    description: 'Heavy-duty recovery winch with synthetic rope and wireless remote',
    category: 'Recovery',
    starting_price: 35000,
    image_url: '/images/product-winch.jpg',
    icon: 'Zap',
  },
  {
    id: 'prod-tires',
    slug: 'bfg-ko2-tires',
    name: 'BF Goodrich KO2 Tires',
    description: 'All-terrain tires designed for serious off-road performance',
    category: 'Wheels & Tires',
    starting_price: 12000,
    image_url: '/images/product-tires.jpg',
    icon: 'Circle',
  },
  {
    id: 'prod-skid-plate',
    slug: 'skid-plate-protection',
    name: 'Skid Plate Protection',
    description: 'Aluminum/steel skid plates for underbody protection',
    category: 'Protection',
    starting_price: 18000,
    image_url: '/images/product-skid-plate.jpg',
    icon: 'Shield',
  },
] as const

export type SeedProduct = (typeof seedProducts)[number]
