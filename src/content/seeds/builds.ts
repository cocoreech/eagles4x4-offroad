// ============================================================
// Demo builds — used when no database builds exist
// ============================================================
// Seed data for the builds gallery. In production, the /builds page
// queries the database; this is a fallback for fresh instances.

export const seedBuilds = [
  {
    slug: 'hilux-full-build',
    title: '4" Lift + ARB Bull Bar Setup',
    vehicle: 'Toyota Hilux · 2024',
    cover: '/images/build-01.jpg',
    tags: ['Lift Kit', 'Suspension', 'Bull Bar', 'Winch'],
  },
  {
    slug: 'ranger-bullbar',
    title: 'Bull Bar + Winch Combo',
    vehicle: 'Ford Ranger · 2023',
    cover: '/images/build-02.jpg',
    tags: ['Bull Bar', 'Winch'],
  },
  {
    slug: 'strada-suspension',
    title: 'Complete Suspension Overhaul',
    vehicle: 'Mitsubishi Strada',
    cover: '/images/build-03.jpg',
    tags: ['Suspension', 'Lift'],
  },
  {
    slug: 'fortuner-wheels',
    title: 'OX Wheels + KO2 Tire Setup',
    vehicle: 'Toyota Fortuner',
    cover: '/images/build-04.jpg',
    tags: ['Wheels', 'Tires'],
  },
  {
    slug: 'dmax-protection',
    title: 'Lift Kit + Skid Plate Armor',
    vehicle: 'Isuzu D-Max · 2023',
    cover: '/images/build-05.jpg',
    tags: ['Lift Kit', 'Protection'],
  },
  {
    slug: 'navara-exterior',
    title: 'Full Exterior Transformation',
    vehicle: 'Nissan Navara · 2024',
    cover: '/images/build-06.jpg',
    tags: ['Bull Bar', 'Lighting', 'Rack'],
  },
] as const

export type SeedBuild = (typeof seedBuilds)[number]
