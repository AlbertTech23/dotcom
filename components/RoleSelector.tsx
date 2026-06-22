'use client'
import { useState } from 'react'
import { Users, Star } from 'lucide-react'

type Role = 'admin' | 'committee' | 'member'

const ROLES: { value: Role; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'member',
    label: 'Member',
    description: 'Regular participant, personal data only',
    icon: <Users size={14} />,
    color: 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50',
  },
  {
    value: 'committee',
    label: 'Committee',
    description: 'Has personal data + full admin access',
    icon: <Star size={14} />,
    color: 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
  },
  // 'admin' is intentionally NOT selectable — admins are seeded directly in the
  // database and can never be granted through the app.
]

export function RoleSelector({ memberId, currentRole }: { memberId: string; currentRole: Role }) {
  const [role, setRole] = useState<Role>(currentRole)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleChange(newRole: Role) {
    if (newRole === role || saving) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/members/${memberId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error('Failed')
      setRole(newRole)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Role</h2>
        {saved && <span className="text-xs text-emerald-500 font-medium">Saved ✓</span>}
        {saving && <span className="text-xs text-slate-400">Saving…</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map(r => (
          <button
            key={r.value}
            onClick={() => handleChange(r.value)}
            disabled={saving}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition ${
              role === r.value
                ? r.color + ' border-current'
                : 'text-slate-400 dark:text-slate-500 border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            } disabled:opacity-50`}
          >
            {r.icon}
            <span>{r.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        {ROLES.find(r => r.value === role)?.description}
      </p>
    </div>
  )
}
