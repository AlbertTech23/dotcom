'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigation } from 'lucide-react'

const PING_INTERVAL_MS = 30_000
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000,
}

export function LocationToggle({ initialSharing }: { initialSharing: boolean }) {
  const [sharing, setSharing] = useState(initialSharing)
  const [loading, setLoading]   = useState(false)
  const [status, setStatus]     = useState<'idle' | 'ok' | 'denied' | 'error'>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendLocation = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        })
        setStatus('ok')
      },
      err => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
      },
      GEO_OPTIONS,
    )
  }, [])

  const startPinging = useCallback(() => {
    if (intervalRef.current) return
    sendLocation()
    intervalRef.current = setInterval(sendLocation, PING_INTERVAL_MS)
  }, [sendLocation])

  const stopPinging = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!sharing) { stopPinging(); return }
    if (!document.hidden) startPinging()
    function onVisibility() {
      if (document.hidden) { stopPinging() } else { startPinging() }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stopPinging(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [sharing, startPinging, stopPinging])

  async function toggle() {
    setLoading(true)
    const next = !sharing
    const res = await fetch('/api/location', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharing: next }),
    })
    if (res.ok) {
      setSharing(next)
      if (!next) setStatus('idle')
    }
    setLoading(false)
  }

  return (
    <div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 space-y-1.5">
      <button
        onClick={toggle}
        disabled={loading}
        className="w-full flex items-center justify-between gap-3 disabled:opacity-60"
      >
        <div className="text-left">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
            <Navigation size={15} className={sharing ? 'text-emerald-500' : 'text-slate-400'} />
            Share My Location
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {sharing
              ? status === 'denied' ? 'Location permission denied'
              : status === 'ok'     ? 'Sharing — pings every 30s while app is open'
              : 'Starting…'
              : 'Off — tap to share with the group'}
          </p>
        </div>

        {/* Toggle switch */}
        <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          sharing ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}>
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            sharing ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </div>
      </button>

      {status === 'denied' && (
        <p className="text-xs text-red-500 dark:text-red-400">
          Allow location in your browser settings, then toggle again.
        </p>
      )}
    </div>
  )
}
