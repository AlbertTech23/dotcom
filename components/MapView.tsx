'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, ChevronLeft, Users } from 'lucide-react'
import { NavLocationToggle } from '@/components/NavLocationToggle'
import { createClient } from '@/lib/supabase/client'
import type { Profile, MapMarker } from '@/types/database'

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-xs">Loading map…</p>
      </div>
    </div>
  ),
})

interface Props {
  initialProfiles: Profile[]
  initialMarkers: MapMarker[]
  isPrivileged: boolean
  initialSharing: boolean
  myId: string
}

export function MapView({ initialProfiles, initialMarkers, isPrivileged, initialSharing, myId }: Props) {
  // Own the live profiles here (single realtime subscription) so the header count
  // and the map pins share one source — the count now updates the instant anyone
  // toggles sharing. The roster query only returns sharers, so this list stays the
  // set of sharing members (UPDATE drops anyone who turns sharing off).
  const [profiles, setProfiles] = useState(initialProfiles)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('map-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setProfiles(prev => {
            const updated = payload.new as Profile
            if (!updated.location_sharing) return prev.filter(p => p.id !== updated.id)
            const exists = prev.find(p => p.id === updated.id)
            return exists ? prev.map(p => p.id === updated.id ? { ...p, ...updated } : p) : [...prev, updated]
          })
        } else if (payload.eventType === 'DELETE') {
          setProfiles(prev => prev.filter(p => p.id !== (payload.old as Profile).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Track my own sharing locally so the count reacts instantly to my own toggle
  // (independent of realtime delivery). Others come from the realtime `profiles`
  // list; exclude myself there to avoid double-counting.
  const [mySharing, setMySharing] = useState(initialSharing)
  useEffect(() => {
    function onSync(e: Event) { setMySharing((e as CustomEvent<boolean>).detail) }
    window.addEventListener('dotcom:location-sharing', onSync)
    return () => window.removeEventListener('dotcom:location-sharing', onSync)
  }, [])

  const sharingCount = profiles.filter(p => p.id !== myId && p.location_sharing).length + (mySharing ? 1 : 0)

  return (
    // Map fills the available canvas; all UI floats over it as absolute overlays.
    // Height = viewport minus the desktop top-nav (h-14 + 1px border) so the page
    // never scrolls; on mobile there's no in-flow nav, so it's the full dynamic vh.
    // dvh accounts for the mobile browser chrome (address bar) collapsing.
    <div className="relative w-full h-[100dvh] md:h-[calc(100dvh-3.5rem-1px)] overflow-hidden">

      {/* ── Map fills the entire container ── */}
      <div className="absolute inset-0">
        <LiveMap profiles={profiles} initialMarkers={initialMarkers} isPrivileged={isPrivileged} />
      </div>

      {/* ── Floating header — chips so everything stays readable over the light
            basemap; Back on the left to match the other pages. ── */}
      <div className="absolute top-0 left-0 right-0 z-[500] pointer-events-none px-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 pointer-events-auto">
            <a
              href={isPrivileged ? '/dashboard' : '/me'}
              className="flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur shadow-md rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition"
            >
              <ChevronLeft size={16} />Back
            </a>
            <div id="onb-map" className="flex items-center gap-2.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur shadow-md rounded-lg px-3 py-1.5">
              <MapPin size={16} className="text-emerald-500 flex-shrink-0" />
              <h1 className="text-sm font-bold text-slate-900 dark:text-white">Live Map</h1>
              <span title={`${sharingCount} sharing location · live`} className="flex items-center gap-1.5 text-[11px] font-semibold rounded-full pl-1.5 pr-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <Users size={12} />
                {sharingCount}
              </span>
            </div>
          </div>

          {isPrivileged && (
            <div className="pointer-events-auto">
              <NavLocationToggle initialSharing={initialSharing} floating />
            </div>
          )}
        </div>
      </div>

      {/* ── Floating legend (lifted above the bottom nav) ── */}
      <div className="absolute bottom-24 left-4 z-[500] pointer-events-none">
        <div className="flex items-center gap-3 text-xs bg-slate-900/70 backdrop-blur-sm text-white/80 rounded-xl px-3 py-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />On Bus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Off Bus
          </span>
        </div>
      </div>

      {/* ── Empty state ── */}
      {sharingCount === 0 && (
        <div className="absolute bottom-36 left-0 right-0 z-[500] flex justify-center pointer-events-none">
          <p className="text-white/60 text-xs bg-slate-900/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
            No members are sharing their location yet.
          </p>
        </div>
      )}
    </div>
  )
}
