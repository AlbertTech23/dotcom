'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoMark } from '@/components/Logo'
import { Check, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)
  // verifying → exchanging the recovery link for a session; invalid → it failed.
  const [verifying, setVerifying] = useState(true)
  const [invalid, setInvalid]     = useState(false)

  // The recovery email link lands here with ?token_hash=…&type=recovery. Verify
  // it into a recovery session before the form is usable. verifyOtp needs no
  // PKCE code-verifier, so this works on any device/browser — unlike the old
  // /auth/callback?code= exchange which only worked in the requesting browser.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')

    async function verify() {
      const supabase = createClient()
      // No token_hash → maybe an already-established recovery session (e.g. a
      // legacy link). Accept it if a session exists, otherwise treat as invalid.
      if (!token_hash) {
        const { data } = await supabase.auth.getSession()
        if (!data.session) setInvalid(true)
        setVerifying(false)
        return
      }
      const { error: err } = await supabase.auth.verifyOtp({
        type: (type as 'recovery') ?? 'recovery',
        token_hash,
      })
      if (err) setInvalid(true)
      setVerifying(false)
      // Strip the token from the URL so a refresh/back doesn't re-verify a
      // now-spent token.
      window.history.replaceState(null, '', window.location.pathname)
    }
    verify()
  }, [])

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

        {verifying ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm rounded-xl px-4 py-3 text-center">
            Verifying your reset link…
          </div>
        ) : invalid ? (
          <div className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3 text-center space-y-2">
            <p>This reset link is invalid or has expired.</p>
            <a href="/login" className="inline-block font-semibold underline">Request a new one</a>
          </div>
        ) : done ? (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <Check size={16} /> Password updated — signing you in…
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white dark:bg-slate-800 rounded-2xl p-6 space-y-4 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">New password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 pr-10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="min 8 chars" />
                <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Confirm password</label>
              <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password"
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
