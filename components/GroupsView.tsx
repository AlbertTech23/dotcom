'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Profile } from '@/types/database'
import { Users, Pencil, Check, X, Trash2, ChevronDown, Plus, ChevronLeft } from 'lucide-react'

interface GroupsViewProps {
  initialProfiles: Profile[]
  persistedGroups: string[]
  isAdmin: boolean
  myGroupLabel?: string | null
}

function groupBy(profiles: Profile[]): Map<string, Profile[]> {
  const map = new Map<string, Profile[]>()
  for (const p of profiles) {
    if (p.role === 'admin') continue
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
  anchor,
  current,
  options,
  onPick,
  onClose,
}: {
  anchor: HTMLElement | null
  current: string | null
  options: string[]
  onPick: (label: string | null) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  // Anchor the dropdown to the button via fixed positioning so the card's
  // `overflow-hidden` can't clip it.
  useLayoutEffect(() => {
    if (!anchor) return
    const r = anchor.getBoundingClientRect()
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }, [anchor])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchor && !anchor.contains(e.target as Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handle)
    // Close on scroll/resize since the fixed position would otherwise drift.
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handle)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose, anchor])

  if (!pos) return null

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos.top, right: pos.right }}
      className="z-50 min-w-[160px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden"
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
    </div>,
    document.body,
  )
}

export function GroupsView({ initialProfiles, persistedGroups, isAdmin, myGroupLabel }: GroupsViewProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [groupNames, setGroupNames] = useState<string[]>(persistedGroups)

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
          const row = payload.new as Profile
          if (payload.eventType === 'INSERT') return prev.some(p => p.id === row.id) ? prev : [...prev, row]
          return prev.map(p => p.id === row.id ? { ...p, ...row } : p)
        })
      })
      // The groups registry (so create/rename/delete from other devices reflect too).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, payload => {
        setGroupNames(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(n => n !== (payload.old as { name: string }).name)
          const name = (payload.new as { name: string }).name
          if (payload.eventType === 'UPDATE') {
            const old = (payload.old as { name?: string }).name
            return [...new Set(prev.map(n => (n === old ? name : n)))]
          }
          return prev.includes(name) ? prev : [...prev, name]
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
    // Update locally first so the move shows instantly (no realtime dependency).
    setProfiles(prev => prev.map(p => (p.id === memberId ? { ...p, group_label: groupLabel } : p)))
    await fetch('/api/admin/groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, groupLabel }),
    })
    toast.success(groupLabel ? `Moved to ${groupLabel}` : 'Removed from group')
  }

  async function renameGroup(oldLabel: string, newLabel: string) {
    setRenamingGroup(null)
    const next = newLabel.trim()
    if (!next || oldLabel === next) return
    setGroupNames(prev => prev.map(n => (n === oldLabel ? next : n)))
    setProfiles(prev => prev.map(p => (p.group_label === oldLabel ? { ...p, group_label: next } : p)))
    await fetch('/api/admin/groups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldLabel, newLabel: next }),
    })
    toast.success('Group renamed')
  }

  async function deleteGroup(label: string) {
    setDeletingGroup(null)
    setGroupNames(prev => prev.filter(n => n !== label))
    setProfiles(prev => prev.map(p => (p.group_label === label ? { ...p, group_label: null } : p)))
    await fetch('/api/admin/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    toast.success(`Group “${label}” deleted`)
  }

  // Persist the new group so it survives refresh even before any member joins it.
  async function createGroup(name: string) {
    setShowNewGroup(false)
    setNewGroupName('')
    const n = name.trim()
    if (!n) return
    setGroupNames(prev => (prev.includes(n) ? prev : [...prev, n]))
    await fetch('/api/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n }),
    })
    toast.success(`Group “${n}” created`)
  }

  const memberGroups = groupBy(profiles)
  const options = [...new Set([...groupNames, ...namedGroups(profiles)])].sort()

  // Every group from the registry (even empty) plus any legacy label-only groups.
  const allNames = [...new Set([
    ...groupNames,
    ...[...memberGroups.keys()].filter(k => k !== 'Unassigned'),
  ])].sort((a, b) => {
    if (myGroupLabel && a === myGroupLabel) return -1
    if (myGroupLabel && b === myGroupLabel) return 1
    return a.localeCompare(b)
  })
  const groupEntries: [string, Profile[]][] = allNames.map(n => [n, memberGroups.get(n) ?? []])
  if (memberGroups.has('Unassigned')) groupEntries.push(['Unassigned', memberGroups.get('Unassigned')!])

  // Reactive header totals.
  const groupTotal  = allNames.length
  const memberTotal = profiles.filter(p => p.role !== 'admin').length
  const backHref    = isAdmin ? '/dashboard' : '/me'

  return (
    <div id="onb-groups" className="space-y-4">
      <div className="flex items-center gap-3">
        <a href={backHref} className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm flex-shrink-0">
          <ChevronLeft size={16} />Back
        </a>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <Users size={20} className="text-purple-500 dark:text-purple-400 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Groups</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {groupTotal} group{groupTotal !== 1 ? 's' : ''} · {memberTotal} members
          </p>
        </div>
      </div>
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
                if (e.key === 'Enter' && newGroupName.trim()) createGroup(newGroupName.trim())
                if (e.key === 'Escape') { setShowNewGroup(false); setNewGroupName('') }
              }}
              placeholder="Group name…"
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            />
            <button onClick={() => createGroup(newGroupName.trim())} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 p-0.5">
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

      {groupEntries.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">No groups yet.</p>
      )}

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

                    <button
                      onClick={() => setDeletingGroup(groupName)}
                      className="text-slate-400 hover:text-red-500 transition p-1 rounded"
                      title="Delete group (moves members to Unassigned)"
                    ><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            </div>

            {/* Member rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {members.map(member => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isAdmin={isAdmin}
                  options={options}
                  isPickerOpen={pickerMemberId === member.id}
                  onToggle={() => setPickerMemberId(pickerMemberId === member.id ? null : member.id)}
                  onPick={label => assignMember(member.id, label)}
                  onClose={() => setPickerMemberId(null)}
                />
              ))}
            </div>
          </div>
        )
      })}

      <ConfirmDialog
        open={!!deletingGroup}
        title="Delete group?"
        message={<>Delete group <strong className="text-slate-700 dark:text-slate-200">{deletingGroup}</strong>? Its members move to Unassigned.</>}
        confirmLabel="Delete"
        onConfirm={() => { const g = deletingGroup; setDeletingGroup(null); if (g) deleteGroup(g) }}
        onCancel={() => setDeletingGroup(null)}
      />
    </div>
  )
}

// ── Single member row with its group-move picker ─────────────
function MemberRow({
  member,
  isAdmin,
  options,
  isPickerOpen,
  onToggle,
  onPick,
  onClose,
}: {
  member: Profile
  isAdmin: boolean
  options: string[]
  isPickerOpen: boolean
  onToggle: () => void
  onPick: (label: string | null) => void
  onClose: () => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
                <div className="flex items-center justify-between px-4 py-2.5">
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
                          ref={btnRef}
                          onClick={onToggle}
                          className="flex items-center gap-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 rounded"
                          title="Move to group"
                        >
                          <ChevronDown size={13} />
                        </button>
                        {isPickerOpen && (
                          <GroupPicker
                            anchor={btnRef.current}
                            current={member.group_label ?? null}
                            options={options}
                            onPick={onPick}
                            onClose={onClose}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
  )
}
