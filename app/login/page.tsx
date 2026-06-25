'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Logo, LogoMark } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Eye, EyeOff } from 'lucide-react'

// Cloudflare Turnstile. When this env var is unset (local dev / before CAPTCHA is
// enabled in Supabase), the widget is skipped and auth works as before — flip it
// on by setting the key here AND enabling CAPTCHA in Supabase Auth at the same time.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const turnstileRef = useRef<TurnstileInstance>(null)

  // Turnstile tokens are single-use — after any auth attempt, clear + re-issue.
  function resetCaptcha() {
    setCaptchaToken('')
    turnstileRef.current?.reset()
  }

  // The auth callback redirects here with ?error=auth_callback when a link
  // (e.g. a stale recovery/magic link) couldn't be verified. Surface it, then
  // strip the param so a refresh doesn't re-toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth_callback') {
      toast.error("That link couldn't be verified. Please request a new one.")
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function handleForgot() {
    if (!email) { toast.error('Enter your email above first, then tap “Forgot password”.'); return }
    const supabase = createClient()
    // Point straight at the reset page. The recovery email link carries a
    // self-contained token_hash (see the Supabase "Reset Password" email
    // template) that /auth/reset verifies via verifyOtp — no PKCE code-verifier
    // cookie needed, so the link works on any device/browser, not just the one
    // that requested it.
    if (TURNSTILE_SITE_KEY && !captchaToken) { toast.error('Please complete the verification first.'); return }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
      captchaToken: captchaToken || undefined,
    })
    resetCaptcha()
    if (err) { toast.error(err.message); return }
    toast.success('If that email exists, a reset link is on its way. Check your inbox.')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (TURNSTILE_SITE_KEY && !captchaToken) { toast.error('Please complete the verification first.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken || undefined },
    })
    if (err) {
      toast.error(err.message)
      resetCaptcha()
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 pr-10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex justify-end mt-1.5">
              <button type="button" onClick={handleForgot}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Forgot password?
              </button>
            </div>
          </div>

          {TURNSTILE_SITE_KEY && (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                options={{ theme: 'auto', size: 'flexible' }}
                onSuccess={setCaptchaToken}
                onExpire={() => setCaptchaToken('')}
                onError={() => setCaptchaToken('')}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
