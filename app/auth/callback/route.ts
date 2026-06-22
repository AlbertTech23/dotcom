import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only allow relative redirect targets (avoid open redirect).
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${origin}${next}`)
}
