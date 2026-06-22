'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from './StatusBadge'
import { formatTime } from '@/lib/utils'
import type { Profile } from '@/types/database'

export function MemberTable({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [search, setSearch]     = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('profiles-table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' },
        payload => {
          if (payload.eventType === 'UPDATE') {
            setProfiles(prev =>
              prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as Profile : p)
            )
          } else if (payload.eventType === 'INSERT') {
            setProfiles(prev => [...prev, payload.new as Profile])
          } else if (payload.eventType === 'DELETE') {
            setProfiles(prev => prev.filter(p => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function toggle(id: string) {
    setToggling(id)
    await fetch(`/api/admin/toggle/${id}`, { method: 'POST' })
    setToggling(null)
  }

  const members = profiles.filter(p => p.role === 'member')
  const filtered = members.filter(p => {
    const q = search.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(q) ||
      (p.student_id ?? '').toLowerCase().includes(q) ||
      (p.group_label ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="search"
        placeholder="Search name, NIM, group…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />

      {/* Count */}
      <p className="text-xs text-slate-500">
        Showing {filtered.length} / {members.length} members
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">NIM</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Group</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Changed</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">No members found</td>
              </tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition">
                <td className="px-4 py-3 font-medium text-white">
                  <Link href={`/dashboard/members/${p.id}`} className="hover:text-blue-400 transition">
                    {p.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{p.student_id ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{p.group_label ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{formatTime(p.last_changed_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggle(p.id)}
                    disabled={toggling === p.id}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                      p.status === 'on_bus'
                        ? 'bg-red-800/60 hover:bg-red-700 text-red-200'
                        : 'bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200'
                    }`}
                  >
                    {toggling === p.id ? '…' : p.status === 'on_bus' ? 'Mark Off' : 'Mark Back'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
