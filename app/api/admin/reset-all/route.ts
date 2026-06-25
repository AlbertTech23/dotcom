import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { serverError } from '@/lib/api'

export async function POST() {
  const supabase = await createClient()

  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { error } = await supabase
    .from('profiles')
    .update({ status: 'on_bus', last_changed_at: new Date().toISOString() })
    .neq('role', 'admin')
    .eq('travel_mode', 'bus')   // Setup Crew / Convoy aren't tracked on/off the bus
    .eq('status', 'off_bus')

  if (error) return serverError('reset-all', error)

  return NextResponse.json({ success: true })
}
