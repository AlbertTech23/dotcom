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

      {/* Map */}
      <div id="onb-bus-map">
        <BusMap
          key={activeBus}
          profiles={profiles}
          setProfiles={setProfiles}
          busNumber={activeBus}
          isAdmin={isAdmin}
          mySeatNumber={myBusNumber === activeBus ? mySeatNumber : null}
        />
      </div>

    </div>
  )
}
