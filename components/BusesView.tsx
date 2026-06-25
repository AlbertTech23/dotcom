'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { BusMap } from '@/components/BusMap'
import { TravelBadge } from '@/components/ParticipantBadge'
import { isBusTraveler, TRAVEL_MODE_LABELS } from '@/lib/utils'
import type { Profile, TravelMode } from '@/types/database'
import { Bus, ChevronLeft, Crosshair, CarFront, X } from 'lucide-react'

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
  // Off-bus travellers panel (Setup Crew / Convoy) — they don't take seats.
  const [showTravelers, setShowTravelers] = useState(false)
  // In-flight travel-mode change (per member id) so admins/committee can reclassify
  // people right here without opening the member detail page.
  const [savingMode, setSavingMode] = useState<string | null>(null)

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

  // Reclassify a participant's travel mode (Bus ↔ Setup Crew ↔ Convoy). Switching
  // off the bus vacates their seat (the API does the same), so we mirror that here.
  async function changeTravelMode(id: string, mode: TravelMode) {
    setSavingMode(id)
    const res = await fetch(`/api/admin/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ travel_mode: mode }),
    })
    setSavingMode(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error((d as { error?: string }).error ?? 'Failed to update travel mode')
      return
    }
    setProfiles(prev => prev.map(p =>
      p.id === id
        ? { ...p, travel_mode: mode, ...(mode !== 'bus' ? { bus_number: null, seat_number: null } : {}) }
        : p,
    ))
    // Drop the hold if the held person just stopped being a bus traveler.
    if (mode !== 'bus') setHeldMemberId(h => (h === id ? null : h))
    const who = profiles.find(p => p.id === id)?.full_name ?? 'Member'
    toast.success(`${who} → ${TRAVEL_MODE_LABELS[mode]}`)
  }

  function jumpToMySeat() {
    if (!myBusNumber) return
    setActiveBus(myBusNumber)
    setTimeout(() => {
      document.getElementById('my-seat')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const bus1Count = profiles.filter(p => p.bus_number === 1 && p.seat_number !== null).length
  const bus2Count = profiles.filter(p => p.bus_number === 2 && p.seat_number !== null).length
  // Only bus travelers need seating — Setup Crew / Convoy don't board, so they're
  // not "unassigned", they just travel separately.
  const unseated = profiles.filter(p => p.role !== 'admin' && isBusTraveler(p.travel_mode) && p.seat_number == null)
  const heldMember = heldMemberId ? profiles.find(p => p.id === heldMemberId) ?? null : null

  // People who don't ride the bus, grouped for the panel.
  const setupCrew = profiles.filter(p => p.role !== 'admin' && p.travel_mode === 'advance')
  const convoy    = profiles.filter(p => p.role !== 'admin' && p.travel_mode === 'convoy')
  const nonBusCount = setupCrew.length + convoy.length

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
        <div className="flex items-center gap-2 flex-shrink-0">
          {nonBusCount > 0 && (
            <button
              onClick={() => setShowTravelers(true)}
              title="Setup Crew & Convoy — travelling without the bus"
              className="flex items-center gap-1.5 text-xs font-semibold border border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 px-3 py-1.5 rounded-lg transition"
            >
              <CarFront size={13} />
              Not on bus
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-violet-600 text-white">{nonBusCount}</span>
            </button>
          )}
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
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-blue-700 dark:text-blue-300">
              Seating <strong>{heldMember.full_name}</strong> — tap an empty seat on Bus {activeBus}
            </span>
            <button onClick={() => setHeldMemberId(null)} className="flex-shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Cancel</button>
          </div>
          {/* …or take them off the bus entirely. */}
          <div className="flex items-center gap-2 text-xs border-t border-blue-200/60 dark:border-blue-800/60 pt-2">
            <span className="text-blue-700/70 dark:text-blue-300/70">or move off bus:</span>
            <button onClick={() => changeTravelMode(heldMember.id, 'advance')} disabled={savingMode === heldMember.id}
              className="font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 px-2 py-1 rounded-md transition disabled:opacity-50">
              Setup Crew
            </button>
            <button onClick={() => changeTravelMode(heldMember.id, 'convoy')} disabled={savingMode === heldMember.id}
              className="font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30 px-2 py-1 rounded-md transition disabled:opacity-50">
              Convoy
            </button>
          </div>
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

      {/* Not-on-bus panel — Setup Crew & Convoy travel separately, so they don't
          appear on the seat map. Bottom-sheet on mobile, centered on desktop. */}
      {showTravelers && (
        <div onClick={() => setShowTravelers(false)}
          className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[80vh]">
            {/* Sticky header so the title + Close stay reachable however long the list */}
            <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Not on the bus ({nonBusCount})</span>
                <button onClick={() => setShowTravelers(false)}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs transition">
                  <X size={14} /> Close
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">These people travel separately and aren&apos;t seated or scanned.</p>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {nonBusCount === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Everyone&apos;s on the bus now.</p>
              )}
              {[
                { label: 'Setup Crew', mode: 'advance' as const, people: setupCrew },
                { label: 'Convoy',     mode: 'convoy'  as const, people: convoy },
              ].filter(g => g.people.length > 0).map(group => (
                <div key={group.mode} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TravelBadge mode={group.mode} />
                    <span className="text-xs text-slate-400 tabular-nums">({group.people.length})</span>
                  </div>
                  <div className="space-y-1">
                    {group.people.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
                        <div className="min-w-0">
                          <span className="block font-medium text-slate-700 dark:text-slate-200 truncate">{p.full_name}</span>
                          {p.group_label && <span className="text-slate-400 text-xs">{p.group_label}</span>}
                        </div>
                        {isAdmin && (
                          <select
                            value={p.travel_mode}
                            disabled={savingMode === p.id}
                            onChange={e => changeTravelMode(p.id, e.target.value as TravelMode)}
                            title="Change travel mode"
                            className="app-select flex-shrink-0 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            <option value="bus">Bus passenger</option>
                            <option value="advance">Setup Crew</option>
                            <option value="convoy">Convoy</option>
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
