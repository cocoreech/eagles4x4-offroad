import { normalizePhMobile } from '@/lib/phone'

export interface ChatLinks {
  viber?: string
  messenger?: string
  whatsapp?: string
  sms?: string
  tel?: string
}

/** PH local "0917..." -> international digits "639...". null if not a PH mobile. */
function toIntlDigits(phone: string | null): string | null {
  const local = normalizePhMobile(phone) // "09171234567" or null
  if (!local) return null
  return '63' + local.slice(1) // drop leading 0, prepend 63
}

/** Extract an m.me path from a stored facebook handle or profile URL. */
function messengerPath(fb: string | null): string | null {
  if (!fb) return null
  const trimmed = fb.trim()
  if (!trimmed) return null
  const m = trimmed.match(/facebook\.com\/([^/?#]+)/i)
  return m ? m[1] : trimmed.replace(/^@/, '')
}

export function buildChatLinks(input: {
  phone: string | null
  facebook: string | null
  message: string
}): ChatLinks {
  const links: ChatLinks = {}
  const text = encodeURIComponent(input.message)

  const intl = toIntlDigits(input.phone)
  if (intl) {
    links.whatsapp = `https://wa.me/${intl}?text=${text}`
    links.viber = `viber://chat?number=%2B${intl}`
    links.sms = `sms:+${intl}?body=${text}`
    links.tel = `tel:+${intl}`
  }

  const mPath = messengerPath(input.facebook)
  if (mPath) links.messenger = `https://m.me/${mPath}`

  return links
}
