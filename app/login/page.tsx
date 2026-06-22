'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Logo, LogoMark } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleForgot() {
    if (!email) { toast.error('Enter your email above first, then tap “Forgot password”.'); return }
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    })
    if (err) { toast.error(err.message); return }
    toast.success('If that email exists, a reset link is on its way. Check your inbox.')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      toast.error(err.message)
      setLoading(false)
      return
    }
    // Full-page navigation (not client routing) so the root layout re-renders
    // server-side with the new auth cookie — that's what makes the nav appear
    // immediately. Middleware sends members to /me and keeps staff on /dashboard.
    window.location.assign('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Theme toggle top-right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <LogoMark variant="tile" size={56} />
          </div>
          <Logo size="hero" tagline />
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1.5 tracking-wide">ACES DOTA REBOOT 2026</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white dark:bg-slate-800 rounded-2xl p-6 space-y-4 border border-slate-200 dark:border-slate-700">
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="you@umn.ac.id"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="••••••••"
            />
            <div className="flex justify-end mt-1.5">
              <button type="button" onClick={handleForgot}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Forgot password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
