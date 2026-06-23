import type { AuthError } from '@supabase/supabase-js'

/**
 * True when a Supabase Auth error means "this email is already registered".
 * Supabase has shifted the exact code/message across versions, so we match the
 * stable `email_exists` code AND the known message variants as a fallback.
 */
export function isDuplicateEmail(error: AuthError | null): boolean {
  if (!error) return false
  if (error.code === 'email_exists') return true
  const msg = error.message?.toLowerCase() ?? ''
  return msg.includes('already been registered') || msg.includes('already registered')
}
