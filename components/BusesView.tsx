'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BusMap } from '@/components/BusMap'
import type { Profile } from '@/types/database'
import { Bus, ChevronLeft, Crosshair } from 'lucide-react'

interface Props {
  initialProfiles: Profile[]
  isAdmin: boolean
  myBusNumber: 1 | 2 | null
  mySeatNumber: number | null
}

export function BusesView({ initialProfiles, isAdmin, myBusNumber, mySeatNumber }: Props) {
  // Default to the user's own bus if assigned
  const [activeBus, setActiveBus] = useState<1 | 2>(myBusNumber ?? 1)
  // Shared state for both bus tabs + the BusMap, so seat changes update the tab
  // counts instantly (and one realtime subscription keeps other devices in sync).
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  // A member "held" for seat placement — set by tapping the tray below or by
  // arriving from the member-add flow (?bus=N&place=id).
  const [heldMemberId, setHeldMemberId] = useState<string | null>(null)
  // A seat to spotlight + scroll to — set when arriving from a member's detail
  // page (?bus=N&seat=S).
  const [focusSeat, setFocusSeat] = useState<number | null>(null)
  const [focusBus, setFocusBus] = useState<1 | 2 | null>(null)

  // Read the deep-link hand-off once, then clean the URL so a refresh doesn't repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const bus = params.get('bus')
    const place = params.get('place')
    const seat = params.get('seat')
    if (bus === '1' || bus === '2') setActiveBus(Number(bus) as 1 | 2)
    if (place) setHeldMemberId(place)
    if (seat && (bus === '1' || bus === '2')) {
      setFocusBus(Number(bus) as 1 | 2)
      setFocusSeat(Number(seat))
    }
    if (bus || place || seat) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  // Scroll the spotlighted seat into view once its bus tab is active (BusMap
  // remounts on tab change, so wait a tick for #focus-seat to exist).
  useEffect(() => {
    if (focusSeat == null || focusBus !== activeBus) return
    const t = setTimeout(() => {
      document.getElementById('focus-seat')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(t)
  }, [focusSeat, focusBus, activeBus])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('buses-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        setProfiles(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== (payload.old as Profile).id)
          const row = payload.new as Profile
          if (payload.eventType === 'INSERT') return prev.some(p => p.id === row.id) ? prev : [...prev, row]
          return prev.map(p => p.id === row.id ? { ...p, ...row } : p)
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  function jumpToMySeat() {
    if (!myBusNumber) return
    setActiveBus(myBusNumber)
    setTimeout(() => {
      document.getElementById('my-seat')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const bus1Count = profiles.filter(p => p.bus_number === 1 && p.seat_number !== null).length
  const bus2Count = profiles.filter(p => p.bus_number === 2 && p.seat_number !== null).length
  const unseated = profiles.filter(p => p.role !== 'admin' && p.seat_number == null)
  const heldMember = heldMemberId ? profiles.find(p => p.id === heldMemberId) ?? null : null

  return (
    <div className="min-h-screen px-4 py-6 pb-24 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href={isAdmin ? '/dashboard' : '/me'} className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm flex-shrink-0">
            <ChevronLeft size={16} />Back
          </a>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
          <Bus size={20} className="text-blue-500 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bus Seating</h1>
            <p className="text-slate-500 text-xs mt-0.5">DOTA Companion</p>
          </div>
        </div>
        {myBusNumber && mySeatNumber && (
          <button
            onClick={jumpToMySeat}
            className="flex items-center gap-1.5 text-xs font-semibold border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-3 py-1.5 rounded-lg transition"
          >
            <Crosshair size={13} />
            My Seat
          </button>
        )}
      </div>

      {/* Bus tabs */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
        {([1, 2] as const).map(bus => (
          <button
            key={bus}
            onClick={() => setActiveBus(bus)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              activeBus === bus
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Bus {bus}
            <span className={`ml-1.5 text-xs tabular-nums ${activeBus === bus ? 'text-blue-200' : 'text-slate-400'}`}>
              ({bus === 1 ? bus1Count : bus2Count}/31)
            </span>
          </button>
        ))}
      </div>

      {/* Unassigned tray — tap a name, then tap a seat (admin only) */}
      {isAdmin && unseated.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <p className="text-xs font-semibold text-slate-500 mb-2">Not seated yet ({unseated.length}) — tap a name, then tap a seat</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {unseated.map(p => (
              <button
                key={p.id}
                onClick={() => setHeldMemberId(h => (h === p.id ? null : p.id))}
                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                  heldMemberId === p.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400'
                }`}
              >
                {p.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Held banner — what to do next */}
      {isAdmin && heldMember && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm">
          <span className="text-blue-700 dark:text-blue-300">
            Seating <strong>{heldMember.full_name}</strong> — tap an empty seat on Bus {activeBus}
          </span>
          <button onClick={() => setHeldMemberId(null)} className="flex-shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Cancel</button>
        </div>
      )}

      {/* Map */}
      <div id="onb-bus-map">
        <BusMap
          key={activeBus}
          profiles={profiles}
          setProfiles={setProfiles}
          busNumber={activeBus}
          isAdmin={isAdmin}
          mySeatNumber={myBusNumber === activeBus ? mySeatNumber : null}
          heldMemberId={heldMemberId}
          setHeldMemberId={setHeldMemberId}
          focusSeat={focusBus === activeBus ? focusSeat : null}
        />
      </div>

    </div>
  )
}
