import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { members, template } = await request.json()

    if (!members?.length || !template) {
      return NextResponse.json({ error: 'Missing members or template' }, { status: 400 })
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const FROM = process.env.EMAIL_FROM ?? 'noreply@flowstategrappling.com'

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 })
    }

    const results = await Promise.allSettled(
      members.map(async (member: { id: string; full_name: string; email: string }) => {
        const body = template.body.replace(/{{name}}/g, member.full_name.split(' ')[0])
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM,
            to: member.email,
            subject: template.subject,
            html: body,
          }),
        })
        return response.json()
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({ sent, failed })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
