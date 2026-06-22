import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// NOTE: we intentionally don't pass a <Database> generic. The installed
// @supabase/ssr + supabase-js versions resolve the typed schema to `never`
// (a known version skew), which is worse than untyped — callers cast query
// results to the types in @/types/database instead.
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch { /* Server Component — ignore */ }
        },
      },
    },
  )
}
