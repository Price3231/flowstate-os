import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const sig = request.headers.get('stripe-signature')

    if (!sig || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Missing config' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new (Stripe as any)(process.env.STRIPE_SECRET_KEY)

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      const userId = pi.metadata?.user_id
      if (userId) {
        await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('stripe_payment_intent_id', pi.id)
        await supabase.from('profiles').update({ status: 'active' }).eq('id', userId)
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent
      await supabase.from('payments').update({ status: 'failed' }).eq('stripe_payment_intent_id', pi.id)
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
