'use client'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { formatTime } from '@/lib/utils'

// Custom circle marker — avoids the default Leaflet icon image issue
function makeIcon(status: 'on_bus' | 'off_bus') {
  const color = status === 'on_bus' ? '#34d399' : '#f87171'
  return L.divIcon({
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.5)
    "></div>`,
    className: '',
    iconSize:   [14, 14],
    iconAnchor: [7, 7],
    popupAnchor:[0, -10],
  })
}

// Fixed reference points for the trip — always shown on the map.
const PINNED_PLACES = [
  { name: 'Titik Kumpul — UMN', lat: -6.256738,  lng: 106.6183029, emoji: '🚩' },
  { name: 'Villa Teras Air',     lat: -6.6850739, lng: 106.925747,  emoji: '🏡' },
]

function makePlaceIcon(emoji: string) {
  return L.divIcon({
    html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.6))">${emoji}</div>`,
    className: '',
    iconSize:   [26, 26],
    iconAnchor: [13, 26],
    popupAnchor:[0, -24],
  })
}

// Forces Leaflet to re-read container dimensions after React finishes layout.
// Without this, the map can initialize at 0×0 inside a dynamic() import,
// leaving pan/zoom geometry wrong until the first resize.
function InvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 0)
    return () => clearTimeout(id)
  }, [map])
  return null
}

// Default center: midpoint between the pinned places (UMN ↔ villa) so both show.
const DEFAULT_CENTER: [number, number] = [-6.4709, 106.772]

interface Props {
  initialProfiles: Profile[]
}

export default function LiveMap({ initialProfiles }: Props) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Realtime subscription — update pins live
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('live-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setProfiles(prev => {
            const updated = payload.new as Profile
            if (!updated.location_sharing) {
              return prev.filter(p => p.id !== updated.id)
            }
            const exists = prev.find(p => p.id === updated.id)
            return exists
              ? prev.map(p => p.id === updated.id ? { ...p, ...updated } : p)
              : [...prev, updated]
          })
        } else if (payload.eventType === 'DELETE') {
          setProfiles(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const visible = profiles.filter(p => p.location_sharing && p.latitude != null && p.longitude != null)

  const center: [number, number] = visible.length > 0
    ? [
        visible.reduce((s, p) => s + p.latitude!, 0) / visible.length,
        visible.reduce((s, p) => s + p.longitude!, 0) / visible.length,
      ]
    : DEFAULT_CENTER

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

  const tileAttribution = isDark
    ? '&copy; <a href="https://carto.com/">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

  return (
    <MapContainer
      center={center}
      zoom={visible.length > 0 ? 14 : 10}
      className="h-full w-full"
    >
      <InvalidateOnMount />
      <TileLayer key={tileUrl} url={tileUrl} attribution={tileAttribution} subdomains="abcd" />

      {/* Fixed trip reference pins */}
      {PINNED_PLACES.map(place => (
        <Marker key={place.name} position={[place.lat, place.lng]} icon={makePlaceIcon(place.emoji)}>
          <Tooltip permanent direction="top" offset={[0, -24]}>{place.name}</Tooltip>
          <Popup><div className="text-sm font-semibold">{place.name}</div></Popup>
        </Marker>
      ))}

      {visible.map(p => (
        <Marker
          key={p.id}
          position={[p.latitude!, p.longitude!]}
          icon={makeIcon(p.status)}
        >
          <Popup>
            <div className="space-y-0.5 text-sm">
              <p className="font-semibold">{p.full_name}</p>
              {p.group_label && <p className="text-slate-500 text-xs">{p.group_label}</p>}
              <p className={`font-semibold text-xs ${p.status === 'on_bus' ? 'text-emerald-600' : 'text-red-500'}`}>
                {p.status === 'on_bus' ? 'On Bus' : 'Off Bus'}
              </p>
              <p className="text-slate-400 text-xs">
                Updated {formatTime(p.location_updated_at)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
