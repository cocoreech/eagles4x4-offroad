import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotificationStore } from './store'
import { listLeadEmails } from './leads'
import { buildCatalogAnnouncementEmail, type CatalogKind } from './catalogEmail'
import { catalogNotificationBody } from './catalogPublish'
import { emailSender } from '@/lib/touchpoints/channels'
import { brand } from '@/content/brand'

export interface CatalogPublishItem {
  kind: CatalogKind
  title: string
  description: string | null
  /** Site-relative path, e.g. "/events/spring-lift-promo". */
  path: string
}

/**
 * Fires on every new catalog item going live (event, promo, product, service,
 * build): in-app notification + email for account holders, email-only for
 * Leads (guest booking contacts with no account). Best-effort — must never
 * block the admin's publish action, so every failure is caught and logged.
 */
export async function notifyCatalogPublish(admin: SupabaseClient, item: CatalogPublishItem): Promise<void> {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const link = `${siteUrl}${item.path}`

    const [{ data: customers, error: custErr }, leadEmails, { data: optOuts, error: optErr }] = await Promise.all([
      admin.from('profiles').select('id, email').eq('role', 'customer'),
      listLeadEmails(admin),
      admin.from('email_opt_outs').select('email'),
    ])
    if (custErr) throw new Error(`notifyCatalogPublish: ${custErr.message}`)
    if (optErr) throw new Error(`notifyCatalogPublish: ${optErr.message}`)

    const suppressed = new Set((optOuts ?? []).map(o => (o.email as string).toLowerCase()))
    const customerRows = customers ?? []

    // In-app bell for account holders.
    const store = createNotificationStore(admin)
    await store.notifyCustomers(
      customerRows.map(c => c.id),
      item.title,
      catalogNotificationBody(item.description, `New ${item.kind.toLowerCase()} just went up — tap to see the details.`),
      item.path,
    )

    // Email — account holders (minus suppressed) + Leads (already suppression-filtered by listLeadEmails).
    const customerEmails = customerRows
      .map(c => (c.email as string | null)?.toLowerCase())
      .filter((e): e is string => !!e && !suppressed.has(e))
    const allRecipients = Array.from(new Set([...customerEmails, ...leadEmails]))

    if (allRecipients.length > 0) {
      const { subject, body } = buildCatalogAnnouncementEmail({
        kind: item.kind,
        title: item.title,
        description: item.description,
        link,
        shopName: brand.name,
      })
      const sender = emailSender({
        apiKey: process.env.RESEND_API_KEY ?? '',
        from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
      })
      const results = await Promise.allSettled(
        allRecipients.map(to => sender.send({ to, subject, body }))
      )
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error('[notifyCatalogPublish] email failed', allRecipients[i], r.reason)
        else if (!r.value.ok) console.error('[notifyCatalogPublish] email failed', allRecipients[i], r.value.error)
      })
    }
  } catch (err) {
    console.error('[notifyCatalogPublish]', err)
  }
}

