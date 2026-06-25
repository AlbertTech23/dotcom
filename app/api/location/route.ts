import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — update own coordinates (called by LocationToggle on interval)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { latitude, longitude } = await req.json()
  const lat = Number(latitude)
  const lng = Number(longitude)
  // Reject anything that isn't a real coordinate (null, NaN, strings, out-of-range)
  // so we never persist garbage into the float8 columns that the whole roster reads.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Valid latitude (±90) and longitude (±180) required' }, { status: 400 })
  }

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PATCH — toggle location_sharing on/off
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sharing } = await req.json()
  if (typeof sharing !== 'boolean') {
    return NextResponse.json({ error: 'sharing (boolean) required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      location_sharing: sharing,
      // Clear coords when turning off so stale location isn't shown
      ...(sharing ? {} : { latitude: null, longitude: null, location_updated_at: null }),
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
