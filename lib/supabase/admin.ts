// Server-only! Never import this in client components.
import { createClient } from '@supabase/supabase-js'

// No <Database> generic — see lib/supabase/server.ts for why.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
