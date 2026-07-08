// Store locations — rendered by /find-a-store.
// Add/remove branches here; the page picks them up automatically.

// Canonical branch slugs — single source of truth. These EXACT strings are
// also the DB constraint values (bookings.branch, profiles.branch) in
// supabase/migrations/0020_branch_scoping.sql. Adding a branch here means
// adding it to that check constraint too.
export type BranchSlug = 'cavite' | 'taguig' | 'quezon-city' | 'valenzuela'

export type Branch = {
  slug: BranchSlug    // canonical id — matches the DB branch column
  name: string        // display name, e.g. "Dasmariñas, Cavite"
  region: string      // short label under the name
  tag: string         // status pill, e.g. "Main Branch" / "Now Open"
  address: string     // full street address
  phone?: string      // contact number, if the branch has one
  hours: string       // opening hours
  facebook?: string   // full Facebook page URL, if any
  isMain?: boolean    // main branch — featured with a map
  bookable?: boolean  // can customers actually book here yet? (pilot: Cavite only)
}

// The address string is also used to build Google Maps / Waze links.
export const BRANCHES: Branch[] = [
  {
    slug: 'cavite',
    name: 'Dasmariñas, Cavite',
    region: 'Cavite',
    tag: 'Now Open',
    address: '6147-A Congressional Ave., Dasmariñas, Cavite',
    hours: 'Mon – Sat · 8:00 AM – 6:00 PM',
    facebook: 'https://www.facebook.com/share/17psWHocRi/',
    isMain: true,
    bookable: true,
  },
  {
    slug: 'taguig',
    name: 'Taguig',
    region: 'Metro Manila',
    tag: 'Now Open',
    address: '111 Bambang ni Felix, Taguig, 1637',
    phone: '+63 999 333 7173',
    hours: 'Open daily',
    facebook: 'https://www.facebook.com/share/14hAzjrRS9y/',
  },
  {
    slug: 'quezon-city',
    name: 'Quezon City',
    region: 'Metro Manila',
    tag: 'Now Open',
    address: '14 East Avenue, Quezon City',
    phone: '+63 994 338 1107',
    hours: 'Open daily',
    facebook: 'https://www.facebook.com/share/17ikRn1G6y/',
  },
  {
    slug: 'valenzuela',
    name: 'Valenzuela',
    region: 'Metro Manila',
    tag: 'Now Open',
    address: '48 Maysan Road, Maysan, Valenzuela',
    hours: 'Open daily',
    facebook: 'https://www.facebook.com/share/1DeZGGjN1L/',
  },
]

/** Google Maps search link for a branch address. */
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Eagles 4x4 Offroad ' + address)}`
}

/** Waze search link for a branch address. */
export function wazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}`
}

/** Embeddable Google Maps iframe src for a branch address (no API key needed). */
export function mapsEmbedUrl(address: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
}
