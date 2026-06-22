'use client'
import { createBrowserClient } from '@supabase/ssr'

// No <Database> generic — see lib/supabase/server.ts for why. Callers cast
// query results / realtime payloads to the types in @/types/database.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
