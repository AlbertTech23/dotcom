'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { KeyRound, ChevronDown, Eye, EyeOff } from 'lucide-react'

/** Logged-in password change (no current-password needed — Supabase uses the session). */
export function ChangePassword() {
  const [open, setOpen]         = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { toast.error(err.message); return }
    toast.success('Password updated')
    setPassword(''); setConfirm('')
    setOpen(false)
  }

  const inputCls = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"

  return (
    <div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
      >
        <span className="flex items-center gap-2"><KeyRound size={15} />Change password</span>
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={submit} className="px-5 pb-4 space-y-2.5 border-t border-slate-100 dark:border-slate-700/60 pt-3">
          <div className="relative">
            <input type={show ? 'text' : 'password'} className={`${inputCls} pr-10`} autoComplete="new-password" minLength={8}
              value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (min 8)" />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input type={show ? 'text' : 'password'} className={inputCls} autoComplete="new-password"
            value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password" />
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium py-2 rounded-lg transition">
            {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}
    </div>
  )
}
