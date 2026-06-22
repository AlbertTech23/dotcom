'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/StatusBadge'
import type { Profile } from '@/types/database'
import { Users, Pencil, Check, X, Trash2, ChevronDown, Plus } from 'lucide-react'

interface GroupsViewProps {
  initialProfiles: Profile[]
  isAdmin: boolean
  myGroupLabel?: string | null
}

function groupBy(profiles: Profile[]): Map<string, Profile[]> {
  const map = new Map<string, Profile[]>()
  for (const p of profiles) {
    if (p.role !== 'member') continue
    const key = p.group_label?.trim() || 'Unassigned'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  const sorted = new Map<string, Profile[]>()
  for (const [k, v] of [...map.entries()].sort((a, b) => {
    if (a[0] === 'Unassigned') return 1
    if (b[0] === 'Unassigned') return -1
    return a[0].localeCompare(b[0])
  })) {
    sorted.set(k, v.sort((a, b) => a.full_name.localeCompare(b.full_name)))
  }
  return sorted
}

function namedGroups(profiles: Profile[]): string[] {
  const set = new Set<string>()
  for (const p of profiles) {
    if (p.group_label?.trim()) set.add(p.group_label.trim())
  }
  return [...set].sort()
}

// ── Inline rename input for group header ─────────────────────
function GroupRenameInput({
  value,
  onSave,
  onCancel,
}: {
  value: string
  onSave: (v: string) => void
  onCancel: () => void
}) {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && v.trim()) onSave(v.trim())
          if (e.key === 'Escape') onCancel()
        }}
        className="w-36 bg-white dark:bg-slate-700 border border-blue-400 dark:border-blue-500 rounded-md px-2 py-0.5 text-sm font-semibold text-slate-900 dark:text-white outline-none"
      />
      <button
        onClick={() => v.trim() && onSave(v.trim())}
        className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 p-0.5"
        title="Save"
      ><Check size={14} /></button>
      <button
        onClick={onCancel}
        className="text-slate-400 hover:text-slate-600 p-0.5"
        title="Cancel"
      ><X size={14} /></button>
    </div>
  )
}

// ── Dropdown to pick a group for a member ────────────────────
function GroupPicker({
  current,
  options,
  onPick,
  onClose,
}: {
  current: string | null
  options: string[]
  onPick: (label: string | null) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-50 min-w-[160px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden"
    >
      {options.map(o => (
        <button
          key={o}
          onClick={() => onPick(o)}
          className={`w-full text-left px-3 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 ${
            current === o ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
          }`}
        >
          {o}
        </button>
      ))}
      {current && (
        <>
          <div className="border-t border-slate-100 dark:border-slate-700" />
          <button
            onClick={() => onPick(null)}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            Remove from group
          </button>
        </>
      )}
    </div>
  )
}

export function GroupsView({ initialProfiles, isAdmin, myGroupLabel }: GroupsViewProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [pendingGroups, setPendingGroups] = useState<string[]>([])

  // Group header rename / delete state
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null)

  // Per-member group picker
  const [pickerMemberId, setPickerMemberId] = useState<string | null>(null)

  // New group form
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const newGroupRef = useRef<HTMLInputElement>(null)

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('groups-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        setProfiles(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== (payload.old as Profile).id)
          if (payload.eventType === 'INSERT') return [...prev, payload.new as Profile]
          return prev.map(p => p.id === (payload.new as Profile).id ? { ...p, ...payload.new } : p)
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (showNewGroup) newGroupRef.current?.focus()
  }, [showNewGroup])

  // ── API helpers ──────────────────────────────────────────
  async function assignMember(memberId: string, groupLabel: string | null) {
    setPickerMemberId(null)
    await fetch('/api/admin/groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, groupLabel }),
    })
  }

  async function renameGroup(oldLabel: string, newLabel: string) {
    setRenamingGroup(null)
    if (oldLabel === newLabel) return
    await fetch('/api/admin/groups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldLabel, newLabel }),
    })
  }

  async function deleteGroup(label: string) {
    setDeletingGroup(null)
    await fetch('/api/admin/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
  }

  function addPendingGroup(name: string) {
    setShowNewGroup(false)
    setNewGroupName('')
    if (!name) return
    setPendingGroups(prev => prev.includes(name) ? prev : [...prev, name])
  }

  const groups = groupBy(profiles)
  const options = [...new Set([...namedGroups(profiles), ...pendingGroups])].sort()

  const groupEntries: [string, Profile[]][] = [...groups.entries()].sort((a, b) => {
    if (myGroupLabel && a[0] === myGroupLabel) return -1
    if (myGroupLabel && b[0] === myGroupLabel) return 1
    if (a[0] === 'Unassigned') return 1
    if (b[0] === 'Unassigned') return -1
    return 0
  })

  return (
    <div className="space-y-4">
      {/* New group button (admin only) — matches RoomsView "Add Room" style */}
      {isAdmin && (
        showNewGroup ? (
          <div className="w-full border border-dashed border-blue-400 dark:border-blue-500 rounded-2xl px-4 py-3 flex items-center gap-2">
            <Users size={16} className="text-slate-400 flex-shrink-0" />
            <input
              ref={newGroupRef}
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newGroupName.trim()) addPendingGroup(newGroupName.trim())
                if (e.key === 'Escape') { setShowNewGroup(false); setNewGroupName('') }
              }}
              placeholder="Group name…"
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            />
            <button onClick={() => addPendingGroup(newGroupName.trim())} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 p-0.5">
              <Check size={15} />
            </button>
            <button onClick={() => { setShowNewGroup(false); setNewGroupName('') }} className="text-slate-400 hover:text-slate-600 p-0.5">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewGroup(true)}
            className="w-full border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400 text-slate-500 hover:text-slate-700 dark:hover:text-white text-sm font-medium py-3 rounded-2xl transition flex items-center justify-center gap-2"
          >
            <Plus size={16} /> New Group
          </button>
        )
      )}

      {groups.size === 0 && !pendingGroups.length && (
        <p className="text-slate-500 text-sm text-center py-8">No members yet.</p>
      )}

      {/* Pending (empty) groups — visible only until a member is assigned */}
      {pendingGroups.filter(g => !groups.has(g)).map(g => (
        <div key={g} className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <span className="font-semibold text-slate-500">{g}</span>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">empty — assign a member below</span>
            </div>
            <button
              onClick={() => setPendingGroups(prev => prev.filter(x => x !== g))}
              className="text-slate-400 hover:text-red-500 transition p-0.5"
              title="Discard"
            ><X size={14} /></button>
          </div>
        </div>
      ))}

      {groupEntries.map(([groupName, members]) => {
        const isMyGroup = !!(myGroupLabel && groupName === myGroupLabel)
        const isUnassigned = groupName === 'Unassigned'

        return (
          <div
            key={groupName}
            className={`rounded-2xl border overflow-hidden transition-all ${
              isMyGroup
                ? 'bg-white dark:bg-slate-800 border-emerald-400 dark:border-emerald-600 shadow-md shadow-emerald-100 dark:shadow-emerald-900/30'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}
          >
            {/* Group header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              isMyGroup
                ? 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/50 dark:bg-emerald-900/10'
                : 'border-slate-200 dark:border-slate-700'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <Users size={16} className={
                  isMyGroup ? 'text-emerald-500 flex-shrink-0' :
                  isUnassigned ? 'text-slate-400 flex-shrink-0' :
                  'text-purple-500 dark:text-purple-400 flex-shrink-0'
                } />

                {isAdmin && renamingGroup === groupName ? (
                  <GroupRenameInput
                    value={groupName}
                    onSave={v => renameGroup(groupName, v)}
                    onCancel={() => setRenamingGroup(null)}
                  />
                ) : (
                  <span className={`font-semibold ${isUnassigned ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                    {groupName}
                  </span>
                )}

                {isMyGroup && (
                  <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    Your Group
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-slate-500 tabular-nums mr-1">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </span>

                {isAdmin && !isUnassigned && renamingGroup !== groupName && (
                  <>
                    <button
                      onClick={() => { setDeletingGroup(null); setRenamingGroup(groupName) }}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 rounded"
                      title="Rename group"
                    ><Pencil size={13} /></button>

                    {deletingGroup === groupName ? (
                      <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-0.5">
                        <span className="text-xs text-red-600 dark:text-red-400">Remove group?</span>
                        <button
                          onClick={() => deleteGroup(groupName)}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 p-0.5"
                          title="Confirm"
                        ><Check size={13} /></button>
                        <button
                          onClick={() => setDeletingGroup(null)}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                        ><X size={13} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingGroup(groupName)}
                        className="text-slate-400 hover:text-red-500 transition p-1 rounded"
                        title="Delete group (moves members to Unassigned)"
                      ><Trash2 size={13} /></button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Member rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-900 dark:text-white text-sm truncate">{member.full_name}</span>
                    {member.student_id && (
                      <span className="text-slate-400 text-xs hidden sm:block">{member.student_id}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={member.status} />

                    {/* Group move picker (admin only) */}
                    {isAdmin && options.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setPickerMemberId(pickerMemberId === member.id ? null : member.id)}
                          className="flex items-center gap-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 rounded"
                          title="Move to group"
                        >
                          <ChevronDown size={13} />
                        </button>
                        {pickerMemberId === member.id && (
                          <GroupPicker
                            current={member.group_label ?? null}
                            options={options}
                            onPick={label => assignMember(member.id, label)}
                            onClose={() => setPickerMemberId(null)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
