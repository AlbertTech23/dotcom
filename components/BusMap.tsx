'use client'
import { useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { isBusTraveler } from '@/lib/utils'
import type { Profile } from '@/types/database'
import { X, CheckCircle2, LogOut as LogOutIcon, Plus } from 'lucide-react'

type Cell = number | 'D' | 'CAD' | null
const BUS_LAYOUT: Cell[][] = [
  [null, 'D',  null, null, 'CAD'],
  [1,    2,    null, 3,    4   ],
  [5,    6,    null, 7,    8   ],
  [null, null, null, 9,    10  ],
  [11,   12,   null, 13,   14  ],
  [15,   16,   null, 17,   18  ],
  [19,   20,   null, 21,   22  ],
  [23,   24,   null, 25,   26  ],
  [27,   28,   29,   30,   31  ],
]

interface Props {
  profiles: Profile[]
  setProfiles: Dispatch<SetStateAction<Profile[]>>
  busNumber: 1 | 2
  isAdmin: boolean
  mySeatNumber?: number | null
  /** A member "held" for placement (from the unassigned tray or member-add flow).
   *  While set, tapping an empty seat assigns them instead of opening the modal. */
  heldMemberId?: string | null
  setHeldMemberId?: Dispatch<SetStateAction<string | null>>
  /** Seat to spotlight when arriving via a deep-link (e.g. from a member's detail
   *  page). Gets id="focus-seat" so the parent can scroll it into view. */
  focusSeat?: number | null
}

type SeatStatus = 'empty' | 'on_bus' | 'off_bus'

function getSeatStatus(seat: number, profiles: Profile[], bus: 1 | 2): SeatStatus {
  const p = profiles.find(p => p.bus_number === bus && p.seat_number === seat)
  if (!p) return 'empty'
  return p.status === 'on_bus' ? 'on_bus' : 'off_bus'
}

function getSeatProfile(seat: number, profiles: Profile[], bus: 1 | 2): Profile | null {
  return profiles.find(p => p.bus_number === bus && p.seat_number === seat) ?? null
}

const seatColor: Record<SeatStatus, string> = {
  empty:  'bg-slate-100 dark:bg-slate-700/60 border-slate-300 dark:border-slate-600 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
  on_bus: 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-400 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/70',
  off_bus:'bg-red-100 dark:bg-red-900/50 border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70',
}

export function BusMap({ profiles, setProfiles, busNumber, isAdmin, mySeatNumber, heldMemberId = null, setHeldMemberId, focusSeat = null }: Props) {
  const [selected, setSelected]           = useState<number | null>(null)
  const [assigning, setAssigning]         = useState(false)
  const [assignMemberId, setAssignMemberId] = useState('')
  const [loading, setLoading]             = useState(false)

  const selectedProfile = selected ? getSeatProfile(selected, profiles, busNumber) : null

  async function handleAssign() {
    if (!selected || !assignMemberId) return
    setLoading(true)
    const seat = selected
    const res = await fetch('/api/admin/seats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: assignMemberId, busNumber, seatNumber: seat }) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed to assign seat'); return }
    // Mutate locally so the map updates instantly (no realtime dependency): assign
    // the member (reset to off_bus, mirroring the API), and bump whoever was there.
    setProfiles(prev => prev.map(p => {
      if (p.id === assignMemberId) return { ...p, bus_number: busNumber, seat_number: seat, status: 'off_bus', last_changed_at: new Date().toISOString() }
      if (p.bus_number === busNumber && p.seat_number === seat) return { ...p, bus_number: null, seat_number: null }
      return p
    }))
    toast.success(`Assigned to seat ${seat}`)
    setAssigning(false); setAssignMemberId(''); setSelected(null)
  }

  async function handleUnassign() {
    if (!selectedProfile) return
    setLoading(true)
    const memberId = selectedProfile.id
    const res = await fetch('/api/admin/seats', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed to unassign'); return }
    // Clear the seat locally so the map updates without waiting on realtime.
    setProfiles(prev => prev.map(p => p.id === memberId ? { ...p, bus_number: null, seat_number: null } : p))
    toast.success('Seat cleared')
    setSelected(null)
  }

  // Place the currently "held" member (from the tray / member-add flow) onto a seat.
  async function placeHeld(seat: number) {
    if (!heldMemberId) return
    setLoading(true)
    const res = await fetch('/api/admin/seats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: heldMemberId, busNumber, seatNumber: seat }) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed to assign seat'); return }
    setProfiles(prev => prev.map(p => p.id === heldMemberId ? { ...p, bus_number: busNumber, seat_number: seat, status: 'off_bus', last_changed_at: new Date().toISOString() } : p))
    toast.success(`Assigned to seat ${seat}`)
    setHeldMemberId?.(null)
  }

  function handleSeatClick(seat: number) {
    // Holding someone → empty seat places them; occupied seat is rejected.
    if (heldMemberId) {
      if (getSeatProfile(seat, profiles, busNumber)) { toast.error('Seat taken — pick an empty one'); return }
      placeHeld(seat)
      return
    }
    setSelected(prev => (prev === seat ? null : seat))
    setAssigning(false)
  }

  // Anyone without a seat is assignable to this bus — regardless of which bus
  // they were nominally pencilled into. Gating on bus_number used to hide members
  // pre-assigned to the *other* bus but never seated, making them unassignable
  // here (they also don't show under "Move from another seat" — no seat to move).
  // Only bus travelers are seatable — Setup Crew / Convoy don't board.
  const allUnassigned = profiles.filter(p =>
    p.role !== 'admin' && isBusTraveler(p.travel_mode) && p.seat_number === null
  )
  // Already-seated participants — offered so an admin can MOVE someone into the
  // selected seat (the seats API vacates their previous seat automatically).
  const seated = profiles.filter(p =>
    p.role !== 'admin' && isBusTraveler(p.travel_mode) && p.seat_number !== null && !(p.bus_number === busNumber && p.seat_number === selected)
  )
  const busLabel = (n: number | null) => (n === 1 ? 'A' : n === 2 ? 'B' : '?')

  const selectCls = "app-select w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-4">
      {/* Bus map */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 overflow-x-auto">
        <div className="text-center text-xs text-slate-400 mb-3 tracking-widest uppercase">Front / Driver</div>
        <div className="block min-w-[260px] w-full max-w-[320px] mx-auto">
          {BUS_LAYOUT.map((row, ri) => (
            <div key={ri} className="grid grid-cols-5 gap-1.5 mb-1.5">
              {row.map((cell, ci) => {
                if (cell === null) return <div key={ci} />
                if (cell === 'D' || cell === 'CAD') {
                  return (
                    <div key={ci}
                      className="aspect-square rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[9px] text-slate-500 font-semibold">
                      {cell}
                    </div>
                  )
                }
                const status = getSeatStatus(cell, profiles, busNumber)
                const isSelected = selected === cell
                const isMine = mySeatNumber === cell
                const isFocus = focusSeat === cell
                return (
                  <button key={ci}
                    id={isFocus ? 'focus-seat' : isMine ? 'my-seat' : undefined}
                    onClick={() => handleSeatClick(cell)}
                    className={`aspect-square rounded-lg border text-xs font-bold transition-all
                      ${seatColor[status]}
                      ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 scale-110' : ''}
                      ${isFocus && !isSelected ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 scale-110' : ''}
                      ${isMine && !isSelected && !isFocus ? 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}
                      ${heldMemberId && status === 'empty' ? 'ring-2 ring-blue-400/70 animate-pulse' : ''}
                    `}
                  >
                    {cell}
                    {isMine && <span className="block text-[10px] font-semibold leading-none -mt-0.5 text-amber-600 dark:text-amber-400">me</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-slate-400 mt-3 tracking-widest uppercase">Back</div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-400 dark:border-emerald-700 inline-block" />On Bus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 inline-block" />Off Bus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 inline-block" />Empty
        </span>
        {mySeatNumber && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border-2 border-amber-400 dark:border-amber-500 inline-block" />You
          </span>
        )}
      </div>

      {/* Seat detail — modal so it appears right where you're looking, not buried
          below the map. Bottom-sheet on mobile, centered on desktop. */}
      {selected && (
        <div onClick={() => { setSelected(null); setAssigning(false) }}
          className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Seat {selected}</span>
            <button onClick={() => { setSelected(null); setAssigning(false) }}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs transition">
              <X size={14} /> Close
            </button>
          </div>

          {selectedProfile ? (
            <>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">{selectedProfile.full_name}</p>
                {selectedProfile.student_id && <p className="text-xs text-slate-500">NIM: {selectedProfile.student_id}</p>}
                {selectedProfile.group_label && <p className="text-xs text-slate-500">Group: {selectedProfile.group_label}</p>}
                <p className={`flex items-center gap-1 text-xs font-semibold ${
                  selectedProfile.status === 'on_bus' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {selectedProfile.status === 'on_bus'
                    ? <><CheckCircle2 size={13} /> On Bus</>
                    : <><LogOutIcon size={13} /> Off Bus</>
                  }
                </p>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <Link href={`/dashboard/members/${selectedProfile.id}`}
                    className="flex-1 text-center text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white py-2 rounded-lg transition">
                    View Detail
                  </Link>
                )}
                {isAdmin && (
                  <button onClick={handleUnassign} disabled={loading}
                    className="flex-1 text-xs font-semibold border border-slate-300 dark:border-slate-600 hover:border-red-500 text-slate-500 hover:text-red-500 py-2 rounded-lg transition disabled:opacity-50">
                    {loading ? 'Removing…' : 'Unassign'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-500 text-sm">No one assigned to this seat.</p>
              {isAdmin && !assigning && (
                <button onClick={() => setAssigning(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg transition">
                  <Plus size={13} /> Assign Member
                </button>
              )}
              {isAdmin && assigning && (
                <div className="space-y-2">
                  <select value={assignMemberId} onChange={e => setAssignMemberId(e.target.value)} className={selectCls}>
                    <option value="">Select a member…</option>
                    {allUnassigned.length > 0 && (
                      <optgroup label="Unassigned">
                        {allUnassigned.map(p => <option key={p.id} value={p.id}>{p.full_name}{p.student_id ? ` (${p.student_id})` : ''}</option>)}
                      </optgroup>
                    )}
                    {seated.length > 0 && (
                      <optgroup label="Move from another seat">
                        {seated.map(p => <option key={p.id} value={p.id}>{p.full_name} — Bus {busLabel(p.bus_number)} seat {p.seat_number}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => setAssigning(false)}
                      className="flex-1 text-xs border border-slate-300 dark:border-slate-600 text-slate-500 py-2 rounded-lg transition hover:border-slate-400">
                      Cancel
                    </button>
                    <button onClick={handleAssign} disabled={!assignMemberId || loading}
                      className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-2 rounded-lg transition">
                      {loading ? 'Saving…' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          </div>
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {(['on_bus', 'off_bus', 'empty'] as const).map(s => {
          const count = s === 'empty'
            ? BUS_LAYOUT.flat().filter(c => typeof c === 'number').length - profiles.filter(p => p.bus_number === busNumber && p.seat_number !== null).length
            : profiles.filter(p => p.bus_number === busNumber && p.status === s && p.seat_number !== null).length
          return (
            <div key={s} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 py-3">
              <p className={`text-xl font-bold tabular-nums ${
                s === 'on_bus' ? 'text-emerald-600 dark:text-emerald-400' : s === 'off_bus' ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
              }`}>{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {s === 'on_bus' ? 'On Bus' : s === 'off_bus' ? 'Off Bus' : 'Empty'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
