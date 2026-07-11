import { describe, it, expect } from 'vitest'
import { buildCatalogAnnouncementEmail } from './catalogEmail'

describe('buildCatalogAnnouncementEmail', () => {
  it('includes the kind, title, and link', () => {
    const { subject, body } = buildCatalogAnnouncementEmail({
      kind: 'Promo',
      title: 'Suspension Month',
      description: '20% off all lift kits.',
      link: 'https://eagles4x4.example/events/suspension-month',
      shopName: 'Eagles 4x4 Offroad',
    })
    expect(subject).toContain('promo')
    expect(subject).toContain('Suspension Month')
    expect(body).toContain('20% off all lift kits.')
    expect(body).toContain('https://eagles4x4.example/events/suspension-month')
  })

  it('falls back to a generic line when there is no description', () => {
    const { body } = buildCatalogAnnouncementEmail({
      kind: 'Product',
      title: 'Profender Shocks',
      description: null,
      link: 'https://eagles4x4.example/services',
      shopName: 'Eagles 4x4 Offroad',
    })
    expect(body).toMatch(/new product/i)
  })
})
