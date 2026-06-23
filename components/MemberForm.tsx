'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, Room } from '@/types/database'

interface Props {
  mode: 'create' | 'edit'
  profile?: Profile
  rooms: Room[]
  groups: string[]
  /** Only true admins may set a role at creation (committee can't escalate). */
  canAssignRole?: boolean
}

const NEW = '__new__'

export function MemberForm({ mode, profile, rooms, groups, canAssignRole = false }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    email:       '',
    password:    '',
    full_name:   profile?.full_name   ?? '',
    student_id:  profile?.student_id  ?? '',
    phone:       profile?.phone       ?? '',
    group_label: profile?.group_label ?? '',
    room_id:     profile?.room_id     ?? '',
    bus_number:  profile?.bus_number ? String(profile.bus_number) : '',
    role:        profile?.role        ?? 'member',
  })
  const [roomList, setRoomList]   = useState<Room[]>(rooms)
  const [groupList, setGroupList] = useState<string[]>(groups)
  const [groupMode, setGroupMode] = useState<'pick' | 'new'>('pick')
  const [roomMode, setRoomMode]   = useState<'pick' | 'new'>('pick')
  const [newGroupName, setNewGroupName] = useState('')
  const [newRoomName, setNewRoomName]   = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Groups are free-text labels (no groups table) — "creating" one just registers
  // it in the dropdown and selects it; it persists when the member is saved.
  function createGroup() {
    const name = newGroupName.trim()
    if (!name) return
    setGroupList(prev => (prev.includes(name) ? prev : [...prev, name].sort()))
    update('group_label', name)
    setGroupMode('pick')
    setNewGroupName('')
    toast.success(`Group “${name}” added`)
  }

  async function createRoom() {
    const name = newRoomName.trim()
    if (!name) return
    setCreatingRoom(true)
    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create room')
      const created = data as Room
      setRoomList(prev => [...prev, created])
      update('room_id', created.id)
      setRoomMode('pick')
      setNewRoomName('')
      toast.success(`Room “${created.name}” created`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setCreatingRoom(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const shared = {
      full_name:   form.full_name,
      student_id:  form.student_id,
      phone:       form.phone,
      group_label: form.group_label.trim() || null,
      room_id:     form.room_id || null,
      bus_number:  form.bus_number ? Number(form.bus_number) : null,
    }

    try {
      if (mode === 'create') {
        // Members sign in with their NIM as the password; committee set one manually.
        const password = form.role === 'member' ? form.student_id : form.password
        const res = await fetch('/api/admin/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...shared,
            email: form.email,
            password,
            ...(canAssignRole ? { role: form.role } : {}),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      } else {
        const res = await fetch(`/api/admin/members/${profile!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shared),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      }
      toast.success(mode === 'create' ? 'Member added' : 'Member updated')
      router.push('/dashboard')
      router.refresh()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
  const labelClass = "block text-sm text-slate-700 dark:text-slate-300 mb-1"
  const isMember = form.role === 'member'
  const nimRequired = mode === 'create' && isMember  // member's password is their NIM

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Role first — it drives password behavior (members use their NIM). Admins only. */}
      {mode === 'create' && canAssignRole && (
        <div>
          <label className={labelClass}>Role</label>
          <select className={`${inputClass} app-select`} value={form.role} onChange={e => update('role', e.target.value)}>
            <option value="member">Member</option>
            <option value="committee">Committee — staff access + personal data</option>
          </select>
        </div>
      )}

      {mode === 'create' && (
        <>
          <div>
            <label className={labelClass}>Email *</label>
            <input type="email" required className={inputClass}
              value={form.email} onChange={e => update('email', e.target.value)} placeholder="member@umn.ac.id" />
          </div>
          <div>
            <label className={labelClass}>Password {isMember ? '' : '*'}</label>
            {isMember ? (
              <>
                <input type="text" disabled value={form.student_id}
                  className={`${inputClass} opacity-60 cursor-not-allowed`} placeholder="Set automatically from NIM" />
                <p className="text-xs text-slate-400 mt-1">Members sign in with their <strong>NIM</strong> as the initial password — they can change it later from their profile.</p>
              </>
            ) : (
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required className={`${inputClass} pr-10`} minLength={8}
                  value={form.password} onChange={e => update('password', e.target.value)} placeholder="min 8 chars" />
                <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div>
        <label className={labelClass}>Full Name *</label>
        <input type="text" required className={inputClass}
          value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Budi Santoso" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>NIM{nimRequired ? ' *' : ''}</label>
          <input type="text" className={inputClass} required={nimRequired}
            value={form.student_id} onChange={e => update('student_id', e.target.value)} placeholder="00000012345" />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input type="tel" className={inputClass}
            value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="08xxxxxxxxxx" />
        </div>
      </div>

      {/* Group + Bus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Group</label>
          <select
            className={`${inputClass} app-select`}
            value={groupMode === 'new' ? NEW : form.group_label}
            onChange={e => {
              if (e.target.value === NEW) { setGroupMode('new'); setNewGroupName('') }
              else { setGroupMode('pick'); update('group_label', e.target.value) }
            }}
          >
            <option value="">No group</option>
            {groupList.map(g => <option key={g} value={g}>{g}</option>)}
            <option value={NEW}>+ Add new group</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Bus</label>
          <select className={`${inputClass} app-select`} value={form.bus_number} onChange={e => update('bus_number', e.target.value)}>
            <option value="">No bus</option>
            <option value="1">Bus A</option>
            <option value="2">Bus B</option>
          </select>
        </div>
      </div>

      {/* New-group input (full width, matches the room create row) */}
      {groupMode === 'new' && (
        <div className="flex gap-2">
          <input type="text" className={inputClass} autoFocus
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createGroup() } }}
            placeholder="New group name" />
          <button type="button" onClick={createGroup} disabled={!newGroupName.trim()}
            className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 rounded-lg transition">
            <Check size={15} />Create
          </button>
        </div>
      )}

      {/* Room */}
      <div>
        <label className={labelClass}>Room</label>
        <select
          className={`${inputClass} app-select`}
          value={roomMode === 'new' ? NEW : form.room_id}
          onChange={e => {
            if (e.target.value === NEW) { setRoomMode('new'); update('room_id', '') }
            else { setRoomMode('pick'); update('room_id', e.target.value) }
          }}
        >
          <option value="">No room</option>
          {roomList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          <option value={NEW}>+ Add new room</option>
        </select>
        {roomMode === 'new' && (
          <div className="flex gap-2 mt-2">
            <input type="text" className={inputClass} autoFocus
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createRoom() } }}
              placeholder="New room name" />
            <button type="button" onClick={createRoom} disabled={!newRoomName.trim() || creatingRoom}
              className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 rounded-lg transition">
              <Check size={15} />{creatingRoom ? '…' : 'Create'}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()}
          className="flex-1 border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400 text-slate-600 dark:text-slate-300 py-2.5 rounded-lg text-sm font-medium transition">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-2.5 rounded-lg text-sm font-semibold transition">
          {loading ? 'Saving…' : mode === 'create' ? 'Add Member' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
