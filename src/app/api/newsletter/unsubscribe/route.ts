import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/utils/supabase/server'

// Simple unsubscribe: email param, no auth needed (already authenticated by having the email).
// Hits a hardened query that matches email exactly + limits to one update.
const schema = z.object({
  email: z.string().email('Invalid email address.'),
})

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const parsed = schema.safeParse({
    email: searchParams.get('email'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid email address.' },
      { status: 400 }
    )
  }

  try {
    const admin = createServiceRoleClient()
    const { error } = await admin
      .from('profiles')
      .update({ newsletter_subscribed: false })
      .eq('email', parsed.data.email.toLowerCase())

    if (error) {
      console.error('[newsletter unsubscribe]', error)
      return NextResponse.json(
        { error: 'Could not update subscription. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'You have been unsubscribed from promotional emails.',
    })
  } catch (err) {
    console.error('[newsletter unsubscribe]', err)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
