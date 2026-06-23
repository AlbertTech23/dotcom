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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    // Don't silently redirect on a failed exchange — that produced the misleading
    // "invalid or expired" dead-end. Send the user back to login with a flag.
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback`)
    }
  }
  return NextResponse.redirect(`${origin}${next}`)
}
