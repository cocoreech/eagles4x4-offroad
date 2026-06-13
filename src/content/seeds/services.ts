// ============================================================
// Demo services — used when no database services exist
// ============================================================
// Seed data for the services page and booking flow. In production,
// the services page queries the database; this is a fallback for
// fresh instances or demo environments.

export const seedServices = [
  {
    id: 'svc-lift-kit',
    slug: 'lift-kit-installation',
    name: 'Lift Kit Installation',
    description:
      'Complete suspension lift system installation with alignment and testing. ' +
      'Available in 2", 3", and 4" heights. Includes custom fabrication for custom vehicles.',
    category: 'Suspension',
    starting_price: 45000,
    image_url: '/images/service-lift-kit.jpg',
    icon: 'Gauge',
  },
  {
    id: 'svc-suspension',
    slug: 'suspension-upgrade',
    name: 'Suspension Upgrade',
    description:
      'Comprehensive suspension overhaul with premium shocks, springs, and custom tuning. ' +
      'Improves off-road handling and on-road comfort. Dyno-tested for performance.',
    category: 'Suspension',
    starting_price: 85000,
    image_url: '/images/service-suspension.jpg',
    icon: 'Gauge',
  },
  {
    id: 'svc-bull-bar',
    slug: 'bull-bar-installation',
    name: 'Bull Bar Installation',
    description:
      'Heavy-duty front bull bar installation with integrated winch mounts. ' +
      'Available from ARB, Safari, and custom fabrication options.',
    category: 'Protection',
    starting_price: 28000,
    image_url: '/images/service-bull-bar.jpg',
    icon: 'Shield',
  },
  {
    id: 'svc-winch',
    slug: 'winch-installation',
    name: 'Winch Installation',
    description:
      'Professional winch system installation with synthetic rope, wireless remote, ' +
      'and recovery package. Includes training and safety certification.',
    category: 'Recovery',
    starting_price: 35000,
    image_url: '/images/service-winch.jpg',
    icon: 'Zap',
  },
  {
    id: 'svc-wheels-tires',
    slug: 'wheels-tires-upgrade',
    name: 'Wheels & Tires Upgrade',
    description:
      'Complete wheel and tire upgrade with installation, balancing, and alignment. ' +
      'Specializing in BF Goodrich KO2, Goodyear Wrangler, and premium alloys.',
    category: 'Wheels & Tires',
    starting_price: 12000,
    image_url: '/images/service-wheels.jpg',
    icon: 'Circle',
  },
  {
    id: 'svc-protection',
    slug: 'underbody-protection',
    name: 'Underbody Protection',
    description:
      'Aluminum and steel skid plates, rock sliders, and bash plates. ' +
      'Protects critical components during off-road adventures.',
    category: 'Protection',
    starting_price: 18000,
    image_url: '/images/service-protection.jpg',
    icon: 'Shield',
  },
  {
    id: 'svc-custom',
    slug: 'custom-fabrication',
    name: 'Custom Fabrication',
    description:
      'Bespoke modifications tailored to your specific vehicle and goals. ' +
      'In-house welding, machining, and design. No project too ambitious.',
    category: 'Custom',
    starting_price: 50000,
    image_url: '/images/service-custom.jpg',
    icon: 'Wrench',
  },
  {
    id: 'svc-maintenance',
    slug: 'maintenance-service',
    name: 'Maintenance & Diagnostics',
    description:
      'Regular maintenance, diagnostics, and tuning for your off-road setup. ' +
      'Alignment, fluid flushes, and performance testing available.',
    category: 'Maintenance',
    starting_price: 5000,
    image_url: '/images/service-maintenance.jpg',
    icon: 'Wrench',
  },
] as const

export type SeedService = (typeof seedServices)[number]
