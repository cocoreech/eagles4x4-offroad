// Store locations — rendered by /find-a-store.
// Add/remove branches here; the page picks them up automatically.

export type Branch = {
  name: string        // display name, e.g. "Dasmariñas, Cavite"
  region: string      // short label under the name
  tag: string         // status pill, e.g. "Main Branch" / "Now Open"
  address: string     // full street address
  phone?: string      // contact number, if the branch has one
  hours: string       // opening hours
  instagram?: string  // IG handle without the @, if any
  isMain?: boolean    // main/HQ branch — featured with a map
}

// The address string is also used to build Google Maps / Waze links.
export const BRANCHES: Branch[] = [
  {
    name: 'Dasmariñas, Cavite',
    region: 'Cavite — Main Branch',
    tag: 'Main Branch · HQ',
    address: '6147-A Congressional Ave., Dasmariñas, Cavite',
    hours: 'Mon – Sat · 8:00 AM – 6:00 PM',
    isMain: true,
  },
  {
    name: 'Taguig',
    region: 'Metro Manila',
    tag: 'Now Open',
    address: '111 Bambang ni Felix, Taguig, 1637',
    phone: '+63 999 333 7173',
    hours: 'Open daily',
  },
  {
    name: 'Quezon City',
    region: 'Metro Manila',
    tag: 'Now Open',
    address: '14 East Avenue, Quezon City',
    phone: '+63 994 338 1107',
    hours: 'Open daily',
    instagram: 'eagles4x4qc',
  },
  {
    name: 'Valenzuela',
    region: 'Metro Manila',
    tag: 'Now Open',
    address: '48 Maysan Road, Maysan, Valenzuela',
    hours: 'Open daily',
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
