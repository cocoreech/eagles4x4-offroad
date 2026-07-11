export type CatalogKind = 'Event' | 'Promo' | 'Product' | 'Service' | 'Build'

export interface CatalogAnnouncementInput {
  kind: CatalogKind
  title: string
  description: string | null
  link: string // absolute URL
  shopName: string
}

/** Build the "new catalog item" announcement email. Pure. */
export function buildCatalogAnnouncementEmail(input: CatalogAnnouncementInput): {
  subject: string
  body: string
} {
  const subject = `New ${input.kind.toLowerCase()} at ${input.shopName}: ${input.title}`

  const body = [
    `${input.title}`,
    ``,
    input.description ?? `We just posted a new ${input.kind.toLowerCase()} — check it out.`,
    ``,
    `See it here: ${input.link}`,
  ].join('\n')

  return { subject, body }
}
