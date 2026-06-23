import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/route — road route between two points via OpenRouteService.
// The ORS key stays server-side. Any signed-in user may call it (the ruler is
// open to everyone), so we only check auth, not role.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.ORS_API_KEY
  if (!key) return NextResponse.json({ error: 'Routing is not configured (ORS_API_KEY missing)' }, { status: 503 })

  const { start, end } = await req.json()
  const ok = (p: unknown): p is { lat: number; lng: number } =>
    !!p && typeof (p as { lat?: unknown }).lat === 'number' && typeof (p as { lng?: unknown }).lng === 'number'
  if (!ok(start) || !ok(end)) {
    return NextResponse.json({ error: 'start and end coordinates are required' }, { status: 400 })
  }

  try {
    // ORS expects [lng, lat] order.
    const orsRes = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[start.lng, start.lat], [end.lng, end.lat]] }),
    })
    if (!orsRes.ok) {
      const status = orsRes.status === 429 ? 429 : 502
      return NextResponse.json({ error: status === 429 ? 'Routing limit reached, try again later' : 'Routing service error' }, { status })
    }
    const geo = await orsRes.json()
    const feature = geo?.features?.[0]
    if (!feature?.geometry?.coordinates) {
      return NextResponse.json({ error: 'No route found between those points' }, { status: 422 })
    }
    // Back to [lat, lng] for Leaflet; summary has distance (m) and duration (s).
    const geometry = (feature.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng])
    const summary = feature.properties?.summary ?? {}
    return NextResponse.json({ geometry, distance: summary.distance ?? 0, duration: summary.duration ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Could not reach the routing service' }, { status: 502 })
  }
}
