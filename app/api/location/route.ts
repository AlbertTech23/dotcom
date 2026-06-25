import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseBody, serverError, enforceLimit } from '@/lib/api'
import { locationUpdateSchema, locationShareSchema } from '@/lib/schemas'

// POST — update own coordinates (called by LocationToggle on interval)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceLimit('location', user.id)
  if (limited) return limited

  // Reject anything that isn't a real coordinate (null, NaN, strings, out-of-range)
  // so we never persist garbage into the float8 columns that the whole roster reads.
  const parsed = await parseBody(req, locationUpdateSchema)
  if ('res' in parsed) return parsed.res
  const { latitude: lat, longitude: lng } = parsed.data

  // Use admin client — member RLS blocks self-update on profiles.
  // Gate on location_sharing = true so coordinates are only ever persisted for
  // users who have opted in. profiles is readable by all authenticated users, so
  // a non-sharer must never have coordinates sitting in their row.
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ latitude: lat, longitude: lng, location_updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .eq('location_sharing', true)

  if (error) return serverError('location.update', error)
  return NextResponse.json({ success: true })
}

// PATCH — toggle location_sharing on/off
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceLimit('location', user.id)
  if (limited) return limited

  const parsed = await parseBody(req, locationShareSchema)
  if ('res' in parsed) return parsed.res
  const { sharing } = parsed.data

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      location_sharing: sharing,
      // Clear coords when turning off so stale location isn't shown
      ...(sharing ? {} : { latitude: null, longitude: null, location_updated_at: null }),
    })
    .eq('id', user.id)

  if (error) return serverError('location.share', error)
  return NextResponse.json({ success: true })
}
