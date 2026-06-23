'use client'
import dynamic from 'next/dynamic'
import { MapPin, ChevronLeft } from 'lucide-react'
import { NavLocationToggle } from '@/components/NavLocationToggle'
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
}

export function MapView({ initialProfiles, initialMarkers, isPrivileged, initialSharing }: Props) {
  const sharingCount = initialProfiles.filter(p => p.location_sharing).length

  return (
    // Map fills the available canvas; all UI floats over it as absolute overlays.
    // Height = viewport minus the desktop top-nav (h-14 + 1px border) so the page
    // never scrolls; on mobile there's no in-flow nav, so it's the full dynamic vh.
    // dvh accounts for the mobile browser chrome (address bar) collapsing.
    <div className="relative w-full h-[100dvh] md:h-[calc(100dvh-3.5rem-1px)] overflow-hidden">

      {/* ── Map fills the entire container ── */}
      <div className="absolute inset-0">
        <LiveMap initialProfiles={initialProfiles} initialMarkers={initialMarkers} isPrivileged={isPrivileged} />
      </div>

      {/* ── Floating header ── */}
      <div className="absolute top-0 left-0 right-0 z-[500] pointer-events-none">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between bg-gradient-to-b from-slate-900/70 to-transparent">
          <div id="onb-map" className="flex items-center gap-2 pointer-events-auto">
            <MapPin size={18} className="text-emerald-400 flex-shrink-0" />
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Live Map</h1>
              <p className="text-white/60 text-xs">
                {`${sharingCount} member${sharingCount !== 1 ? 's' : ''} sharing`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {isPrivileged && (
              <NavLocationToggle initialSharing={initialSharing} />
            )}
            <a
              href={isPrivileged ? '/dashboard' : '/me'}
              className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm transition"
            >
              <ChevronLeft size={14} />Back
            </a>
          </div>
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
