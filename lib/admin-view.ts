/**
 * Committee members hold full admin DB rights (committee == admin in RLS), but
 * default to the personal/member view. Entering the admin (dashboard) view is
 * gated by ADMIN_VIEW_CODE and remembered in this cookie.
 *
 * The cookie value is HMAC-signed (L2) so it can't be forged by simply sending
 * `admin_view=1` — a committee user must go through enterAdminView (which checks
 * the code) to obtain a valid signature. Signing uses Web Crypto so the same code
 * runs in Edge middleware and Node route handlers.
 */
export const ADMIN_VIEW_COOKIE = 'admin_view'

const PAYLOAD = 'admin_view:granted'

function signingKey(): string {
  // Reuse a high-entropy server-only secret that is always present in this app.
  return process.env.ADMIN_VIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function toBase64Url(buf: ArrayBuffer): string {
  // btoa is available in both the Edge runtime (middleware) and Node — Buffer is not.
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(signingKey()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return toBase64Url(sig)
}

/** Constant-time string comparison (avoids signature timing leaks). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** The signed value to store in the cookie once the code has been verified. */
export async function signedAdminViewValue(): Promise<string> {
  return hmac(PAYLOAD)
}

/** Validate a cookie value's signature. Safe to call in Edge middleware. */
export async function isValidAdminViewCookie(value: string | undefined | null): Promise<boolean> {
  if (!value) return false
  const expected = await hmac(PAYLOAD)
  return safeEqual(value, expected)
}

/** True when the current request carries a VALID signed admin-view cookie. Server-only.
 *  cookies() is imported lazily so the signing helpers above stay free of the
 *  next/headers dependency (usable from Edge middleware and unit tests). */
export async function isAdminViewActive(): Promise<boolean> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  return isValidAdminViewCookie(store.get(ADMIN_VIEW_COOKIE)?.value)
}
