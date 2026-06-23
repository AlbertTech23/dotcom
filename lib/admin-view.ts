import { cookies } from 'next/headers'

/**
 * Committee members hold full admin DB rights (committee == admin in RLS), but
 * default to the personal/member view. Entering the admin (dashboard) view is
 * gated by a code and remembered in this cookie. It's a UX/intent barrier — NOT
 * a privilege boundary — so a plain flag cookie is enough.
 */
export const ADMIN_VIEW_COOKIE = 'admin_view'

/** True when the current request has the admin-view flag set. Server-only. */
export async function isAdminViewActive(): Promise<boolean> {
  const store = await cookies()
  return store.get(ADMIN_VIEW_COOKIE)?.value === '1'
}
