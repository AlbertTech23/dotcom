'use client'
import { useActionState, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { enterAdminView, type AdminViewState } from '@/app/actions/admin-view'
import { LayoutDashboard, X } from 'lucide-react'

const initial: AdminViewState = { error: '' }

/**
 * Committee entry point to the admin (dashboard) view. Renders a trigger button
 * (a compact "chip" for nav bars, or a full-width "card" for in-page placement)
 * that opens a modal asking for the admin-view code. The code is verified by the
 * enterAdminView server action, which redirects to /dashboard on success.
 */
export function AdminViewGate({ variant = 'chip' }: { variant?: 'chip' | 'card' }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [state, action, pending] = useActionState(enterAdminView, initial)

  // Portal target only exists in the browser — gate on mount to stay SSR-safe.
  useEffect(() => { setMounted(true) }, [])

  const modal = (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <LayoutDashboard size={16} className="text-amber-500" />
            Admin View
          </h2>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Enter the access code to switch to the committee dashboard.</p>

        <form action={action} className="space-y-3">
          <input
            name="code"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="Access code"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
          />
          {state.error && (
            <p className="text-red-600 dark:text-red-400 text-xs text-center">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-700 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {pending ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {variant === 'chip' ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
        >
          <LayoutDashboard size={13} />
          Admin View
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-semibold py-2.5 rounded-xl transition"
        >
          <LayoutDashboard size={16} />
          Switch to Admin View
        </button>
      )}

      {open && mounted && createPortal(modal, document.body)}
    </>
  )
}
