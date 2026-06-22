'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types/database'

interface Props {
  mode: 'create' | 'edit'
  profile?: Profile
}

export function MemberForm({ mode, profile }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    email:       '',
    password:    '',
    full_name:   profile?.full_name   ?? '',
    student_id:  profile?.student_id  ?? '',
    phone:       profile?.phone       ?? '',
    group_label: profile?.group_label ?? '',
    role:        profile?.role        ?? 'member',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'create') {
        const res = await fetch('/api/admin/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      } else {
        const res = await fetch(`/api/admin/members/${profile!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name:   form.full_name,
            student_id:  form.student_id,
            phone:       form.phone,
            group_label: form.group_label,
            role:        form.role,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      }
      router.push('/dashboard')
      router.refresh()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
  const labelClass = "block text-sm text-slate-700 dark:text-slate-300 mb-1"

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === 'create' && (
        <>
          <div>
            <label className={labelClass}>Email *</label>
            <input type="email" required className={inputClass}
              value={form.email} onChange={e => update('email', e.target.value)} placeholder="member@umn.ac.id" />
          </div>
          <div>
            <label className={labelClass}>Password *</label>
            <input type="password" required className={inputClass} minLength={8}
              value={form.password} onChange={e => update('password', e.target.value)} placeholder="min 8 chars" />
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
          <label className={labelClass}>NIM</label>
          <input type="text" className={inputClass}
            value={form.student_id} onChange={e => update('student_id', e.target.value)} placeholder="00000012345" />
        </div>
        <div>
          <label className={labelClass}>Group / Bus</label>
          <input type="text" className={inputClass}
            value={form.group_label} onChange={e => update('group_label', e.target.value)} placeholder="Bus A" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Phone</label>
        <input type="tel" className={inputClass}
          value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="08xxxxxxxxxx" />
      </div>

      <div>
        <label className={labelClass}>Role</label>
        <select className={`${inputClass} app-select`} value={form.role} onChange={e => update('role', e.target.value)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">{error}</div>
      )}

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
