// ============================================================
// PayMongo REST client wrapper
// ============================================================
// Uses Checkout Sessions API — simplest UX for our ₱500 deposit.
// Customer redirected to PayMongo-hosted checkout (GCash, Maya,
// GrabPay, Cards, etc.), redirected back to our success/cancel URLs.
//
// Reference: https://developers.paymongo.com/reference/the-checkout-session-object

const PAYMONGO_API = 'https://api.paymongo.com/v1'

function getAuthHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY
  if (!key || key.startsWith('<paste')) {
    throw new Error('PAYMONGO_SECRET_KEY not configured')
  }
  // PayMongo uses Basic Auth with the secret key as username, blank password
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
}

type CheckoutLineItem = {
  amount: number          // in centavos (₱500 = 50000)
  currency: 'PHP'
  description: string
  name: string
  quantity: number
}

type CreateCheckoutSessionParams = {
  bookingId: string
  bookingCode: string
  amountCentavos: number
  description: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  customerPhone?: string
}

export type CheckoutSession = {
  id: string
  checkoutUrl: string
  paymentIntentId: string
  status: string
}

/**
 * Create a PayMongo Checkout Session for the booking deposit.
 * Returns the checkout URL that we redirect the customer to.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSession> {
  const lineItem: CheckoutLineItem = {
    amount:      params.amountCentavos,
    currency:    'PHP',
    description: params.description,
    name:        `Booking deposit · ${params.bookingCode}`,
    quantity:    1,
  }

  const body = {
    data: {
      attributes: {
        line_items: [lineItem],
        payment_method_types: ['gcash', 'paymaya', 'grab_pay', 'card'],
        success_url: params.successUrl,
        cancel_url:  params.cancelUrl,
        description: params.description,
        reference_number: params.bookingCode,
        billing: {
          email: params.customerEmail,
          phone: params.customerPhone,
        },
        // Capture intent immediately (we're not pre-authorizing for later)
        send_email_receipt: true,
        show_description: true,
        show_line_items:  true,
        metadata: {
          booking_id:   params.bookingId,
          booking_code: params.bookingCode,
        },
      },
    },
  }

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[paymongo] createCheckoutSession failed', res.status, errText)
    throw new Error(`PayMongo error: ${res.status}`)
  }

  const json = await res.json()
  // PayMongo response shape:
  // { data: { id, attributes: { checkout_url, payment_intent: { id }, status, ... } } }
  return {
    id:              json.data.id,
    checkoutUrl:     json.data.attributes.checkout_url,
    paymentIntentId: json.data.attributes.payment_intent?.id ?? '',
    status:          json.data.attributes.status,
  }
}

/**
 * Verify a webhook signature using HMAC-SHA256.
 * PayMongo's signature header format:
 *   Paymongo-Signature: t=<timestamp>,te=<test_sig>,li=<live_sig>
 * We compare against `te` in test mode, `li` in live mode.
 */
export async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader) return false
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  if (!secret || secret.startsWith('<paste')) {
    console.warn('[paymongo] PAYMONGO_WEBHOOK_SECRET not configured — rejecting webhook')
    return false
  }

  const parts: Record<string, string> = {}
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=')
    if (k && v) parts[k.trim()] = v.trim()
  }

  const timestamp = parts['t']
  const isLiveKey = secret.startsWith('whsec_live')
  const expectedSigHeader = isLiveKey ? parts['li'] : parts['te']
  if (!timestamp || !expectedSigHeader) return false

  // Build the signed payload as PayMongo does: `{timestamp}.{rawBody}`
  const signedPayload = `${timestamp}.${payload}`

  // Compute HMAC-SHA256 using the webhook secret
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload))
  const computedSig = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  if (computedSig.length !== expectedSigHeader.length) return false
  let diff = 0
  for (let i = 0; i < computedSig.length; i++) {
    diff |= (computedSig.codePointAt(i) ?? 0) ^ (expectedSigHeader.codePointAt(i) ?? 0)
  }
  return diff === 0
}
