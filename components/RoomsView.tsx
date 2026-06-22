'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/StatusBadge'
import type { Profile, Room } from '@/types/database'
import { Building2, Pencil, Trash2, X, Plus } from 'lucide-react'

interface RoomsViewProps {
  initialRooms: Room[]
  initialProfiles: Profile[]
  isAdmin: boolean
  myRoomId?: string | null
}

const EMPTY_FORM = { name: '', floor: '', notes: '', capacity: '' }

export function RoomsView({ initialRooms, initialProfiles, isAdmin, myRoomId }: RoomsViewProps) {
  const [rooms, setRooms]       = useState<Room[]>(initialRooms)
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [showForm, setShowForm]   = useState(false)
  const [editRoom, setEditRoom]   = useState<Room | null>(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [formSaving, setFormSaving] = useState(false)
  const [assigningRoom, setAssigningRoom] = useState<Room | null>(null)
  const [assignMemberId, setAssignMemberId] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const profilesSub = supabase
      .channel('rooms-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        setProfiles(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== (payload.old as Profile).id)
          if (payload.eventType === 'INSERT') return [...prev, payload.new as Profile]
          return prev.map(p => p.id === (payload.new as Profile).id ? { ...p, ...payload.new } : p)
        })
      })
      .subscribe()
    const roomsSub = supabase
      .channel('rooms-table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
        setRooms(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(r => r.id !== (payload.old as Room).id)
          if (payload.eventType === 'INSERT') return [...prev, payload.new as Room]
          return prev.map(r => r.id === (payload.new as Room).id ? { ...r, ...payload.new } : r)
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(profilesSub); supabase.removeChannel(roomsSub) }
  }, [])

  function openCreate() { setEditRoom(null); setForm(EMPTY_FORM); setShowForm(true) }
  function openEdit(room: Room) {
    setEditRoom(room)
    setForm({ name: room.name, floor: room.floor || '', notes: room.notes || '', capacity: room.capacity?.toString() || '' })
    setShowForm(true)
  }

  async function submitForm() {
    if (!form.name.trim()) return
    setFormSaving(true)
    const body = { name: form.name.trim(), floor: form.floor.trim() || null, notes: form.notes.trim() || null, capacity: form.capacity ? parseInt(form.capacity) : null }
    if (editRoom) {
      await fetch(`/api/admin/rooms/${editRoom.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/admin/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setFormSaving(false); setShowForm(false)
  }

  async function deleteRoom(room: Room) {
    if (!confirm(`Delete room "${room.name}"? All occupants will be unassigned.`)) return
    await fetch(`/api/admin/rooms/${room.id}`, { method: 'DELETE' })
  }

  async function assignMember() {
    if (!assigningRoom || !assignMemberId) return
    setAssigning(true)
    await fetch('/api/admin/rooms/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: assignMemberId, roomId: assigningRoom.id }) })
    setAssigning(false); setAssignMemberId('')
  }

  async function unassignMember(memberId: string) {
    await fetch('/api/admin/rooms/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, roomId: null }) })
  }

  const members   = profiles.filter(p => p.role === 'member')
  const unassigned = members.filter(p => p.room_id === null)

  const inputCls = "w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"

  return (
    <div className="space-y-4">
      {isAdmin && (
        <button onClick={openCreate}
          className="w-full border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400 text-slate-500 hover:text-slate-700 dark:hover:text-white text-sm font-medium py-3 rounded-2xl transition flex items-center justify-center gap-2">
          <Building2 size={16} /> Add Room
        </button>
      )}

      {rooms.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">
          {isAdmin ? 'No rooms yet — add one above.' : 'No rooms have been set up yet.'}
        </p>
      )}

      {rooms.slice().sort((a, b) => {
        // Pin user's room to top
        if (myRoomId && a.id === myRoomId) return -1
        if (myRoomId && b.id === myRoomId) return 1
        return a.name.localeCompare(b.name)
      }).map(room => {
        const occupants = members.filter(p => p.room_id === room.id)
        const isFull = room.capacity != null && occupants.length >= room.capacity
        const isMyRoom = myRoomId === room.id
        return (
          <div key={room.id} className={`rounded-2xl border overflow-hidden transition-all ${
            isMyRoom
              ? 'bg-white dark:bg-slate-800 border-emerald-400 dark:border-emerald-600 shadow-md shadow-emerald-100 dark:shadow-emerald-900/30'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}>
            {/* Room header */}
            <div className={`flex items-start justify-between px-4 py-3 border-b ${
              isMyRoom ? 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700'
            }`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 dark:text-white">{room.name}</span>
                  {isMyRoom && (
                    <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                      Your Room
                    </span>
                  )}
                  {room.floor && (
                    <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{room.floor}</span>
                  )}
                  {room.capacity != null ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${
                      isFull
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 border border-red-300 dark:border-red-700/50'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {occupants.length}/{room.capacity}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 tabular-nums">{occupants.length} occupants</span>
                  )}
                </div>
                {room.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{room.notes}</p>}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <button
                    onClick={() => { setAssigningRoom(assigningRoom?.id === room.id ? null : room); setAssignMemberId('') }}
                    className={`text-xs px-2 py-1 rounded-lg border transition flex items-center gap-1 ${
                      assigningRoom?.id === room.id
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-400'
                    }`}
                  >
                    <Plus size={12} /> Assign
                  </button>
                  <button onClick={() => openEdit(room)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition p-0.5" title="Edit room">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteRoom(room)} className="text-slate-400 hover:text-red-500 transition p-0.5" title="Delete room">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Assign panel */}
            {isAdmin && assigningRoom?.id === room.id && (
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 flex items-center gap-2">
                <select
                  value={assignMemberId}
                  onChange={e => setAssignMemberId(e.target.value)}
                  className="app-select flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 min-w-0"
                >
                  <option value="">Select member to assign…</option>
                  {unassigned.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.student_id ? ` (${m.student_id})` : ''}</option>)}
                  {members.filter(m => m.room_id !== null && m.room_id !== room.id).map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} (move from another room)</option>
                  ))}
                </select>
                <button
                  onClick={assignMember}
                  disabled={!assignMemberId || assigning}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex-shrink-0"
                >
                  {assigning ? '…' : 'Assign'}
                </button>
              </div>
            )}

            {/* Occupants */}
            {occupants.length === 0 ? (
              <p className="text-slate-400 text-xs px-4 py-3">No occupants assigned</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {occupants.sort((a, b) => a.full_name.localeCompare(b.full_name)).map(member => (
                  <div key={member.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-900 dark:text-white text-sm truncate">{member.full_name}</span>
                      {member.student_id && <span className="text-slate-400 text-xs hidden sm:block">{member.student_id}</span>}
                      {member.group_label && (
                        <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded hidden sm:block">{member.group_label}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={member.status} />
                      {isAdmin && (
                        <button onClick={() => unassignMember(member.id)} className="text-slate-400 hover:text-red-500 transition p-0.5" title="Remove from room">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Unassigned section */}
      {isAdmin && unassigned.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/60">
            <span className="text-sm font-semibold text-slate-500">Unassigned</span>
            <span className="text-xs text-slate-400">{unassigned.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/40">
            {unassigned.sort((a, b) => a.full_name.localeCompare(b.full_name)).map(member => (
              <div key={member.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-600 dark:text-slate-400 text-sm">{member.full_name}</span>
                <StatusBadge status={member.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">{editRoom ? 'Edit Room' : 'New Room'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Room name *</label>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Arjuna 201" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Floor / building</label>
                  <input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
                    placeholder="e.g. 2F, Block A" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Capacity</label>
                  <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                    placeholder="e.g. 4" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Extra info…" rows={2} className={`${inputCls} resize-none`} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm py-2.5 rounded-xl transition">
                Cancel
              </button>
              <button onClick={submitForm} disabled={!form.name.trim() || formSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition">
                {formSaving ? 'Saving…' : editRoom ? 'Save Changes' : 'Create Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
