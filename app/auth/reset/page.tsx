'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoMark } from '@/components/Logo'
import { Check } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(err.message.includes('session') || err.message.includes('Auth')
        ? 'This reset link is invalid or expired. Request a new one from the login page.'
        : err.message)
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
    // Land on the role-appropriate home after a moment.
    setTimeout(() => { window.location.assign('/') }, 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <LogoMark variant="tile" size={48} />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-3">Set a new password</h1>
        </div>

        {done ? (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <Check size={16} /> Password updated — signing you in…
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white dark:bg-slate-800 rounded-2xl p-6 space-y-4 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="min 8 chars" />
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="repeat password" />
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-2.5 rounded-lg transition">
              {loading ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
