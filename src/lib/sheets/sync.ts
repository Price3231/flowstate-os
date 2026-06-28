// Google Sheets API v4 integration
// Uses a Service Account for server-to-server auth

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const rawKey = process.env.GOOGLE_PRIVATE_KEY!
  const key = rawKey.replace(/\\n/g, '\n')

  // Create JWT
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')

  const signingInput = `${encode(header)}.${encode(claim)}`

  // Import private key and sign
  const pemBody = key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')
  const binaryKey = Buffer.from(pemBody, 'base64')

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signingInput)
  )

  const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await res.json()
  return data.access_token
}

async function ensureSheet(token: string, sheetId: string, sheetName: string) {
  // Get existing sheets
  const res = await fetch(`${SHEETS_BASE}/${sheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  const exists = data.sheets?.some((s: { properties: { title: string } }) => s.properties.title === sheetName)

  if (!exists) {
    await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    })
  }
}

async function writeSheet(token: string, sheetId: string, sheetName: string, rows: (string | number)[][]) {
  await ensureSheet(token, sheetId, sheetName)

  // Clear then write
  await fetch(`${SHEETS_BASE}/${sheetId}/values/${sheetName}!A1:Z10000:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  await fetch(`${SHEETS_BASE}/${sheetId}/values/${sheetName}!A1?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  })
}

export interface SyncPayload {
  members?: Record<string, unknown>[]
  payments?: Record<string, unknown>[]
  attendance?: Record<string, unknown>[]
  expenses?: Record<string, unknown>[]
}

export async function syncToSheets(payload: SyncPayload) {
  const sheetId = process.env.GOOGLE_SHEETS_ID
  if (!sheetId) throw new Error('GOOGLE_SHEETS_ID not configured')

  const token = await getAccessToken()

  const tasks: Promise<void>[] = []

  if (payload.members?.length) {
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Membership', 'Start Date', 'Renewal Date', 'Deposit Paid', 'Waiver', 'Notes', 'Joined']
    const rows = payload.members.map(m => [
      m.full_name as string,
      m.email as string,
      (m.phone as string) ?? '',
      m.status as string,
      (m.membership_name as string) ?? '',
      (m.membership_start_date as string) ?? '',
      (m.membership_renewal_date as string) ?? '',
      m.deposit_paid ? 'Yes' : 'No',
      m.waiver_accepted ? 'Yes' : 'No',
      (m.notes as string) ?? '',
      m.created_at as string,
    ])
    tasks.push(writeSheet(token, sheetId, 'Members', [headers, ...rows]))
  }

  if (payload.payments?.length) {
    const headers = ['Date', 'Member', 'Email', 'Amount', 'Method', 'Status', 'Membership', 'Notes']
    const rows = payload.payments.map(p => [
      (p.paid_at as string) ?? '',
      (p.member_name as string) ?? '',
      (p.member_email as string) ?? '',
      p.amount as number,
      p.method as string,
      p.status as string,
      (p.membership_name as string) ?? '',
      (p.notes as string) ?? '',
    ])
    tasks.push(writeSheet(token, sheetId, 'Payments', [headers, ...rows]))
  }

  if (payload.attendance?.length) {
    const headers = ['Date', 'Class', 'Member', 'Email', 'Attended']
    const rows = payload.attendance.map(a => [
      (a.session_date as string) ?? '',
      (a.class_title as string) ?? '',
      (a.member_name as string) ?? '',
      (a.member_email as string) ?? '',
      a.attended ? 'Yes' : 'No',
    ])
    tasks.push(writeSheet(token, sheetId, 'Attendance', [headers, ...rows]))
  }

  if (payload.expenses?.length) {
    const headers = ['Date', 'Category', 'Description', 'Amount']
    const rows = payload.expenses.map(e => [
      e.paid_at as string,
      e.category as string,
      e.description as string,
      e.amount as number,
    ])
    tasks.push(writeSheet(token, sheetId, 'Expenses', [headers, ...rows]))
  }

  await Promise.all(tasks)
  return { synced: Object.keys(payload).length }
}
