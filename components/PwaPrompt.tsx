'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Share, Download } from 'lucide-react'
import { LogoMark } from '@/components/Logo'

const DISMISS_KEY = 'dotcom-install-dismissed'
const SNOOZE_MS = 1000 * 60 * 60 * 24 * 14 // re-offer after 14 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Registers the service worker and shows a closeable "install" banner on every
 * page. Android/desktop Chrome get the native install prompt; iOS Safari gets
 * Add-to-Home-Screen instructions (Apple has no programmatic prompt). Hidden when
 * already installed (standalone) or recently dismissed.
 */
export function PwaPrompt() {
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)
  const deferred = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Mobile only — on desktop we leave installing to the browser's native UI and
    // never capture the prompt or show our banner.
    if (!window.matchMedia('(max-width: 767px)').matches) return

    // Already installed → never show.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return

    // Recently dismissed → stay quiet.
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return

    // Android / desktop Chrome: hold the native prompt until the user opts in.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferred.current = e as BeforeInstallPromptEvent
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // Hide the banner if the app gets installed while it's open.
    const onInstalled = () => setMode(null)
    window.addEventListener('appinstalled', onInstalled)

    // iOS Safari: no event fires — detect and show manual instructions.
    const ua = window.navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
    if (isIOS && isSafari) setMode('ios')

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setMode(null)
  }

  async function install() {
    const ev = deferred.current
    if (!ev) return
    await ev.prompt()
    try { await ev.userChoice } catch { /* ignore */ }
    deferred.current = null
    setMode(null)
  }

  if (!mode) return null

  return (
    <div
      className="fixed top-0 inset-x-0 z-[800] px-3"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
    >
      <div className="mx-auto max-w-lg min-w-0 flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white/95 dark:bg-slate-800/95 backdrop-blur px-3 py-2 shadow-lg">
        <LogoMark variant="tile" size={32} />
        <div className="min-w-0 flex-1 text-sm leading-snug text-slate-700 dark:text-slate-200">
          {mode === 'android' ? (
            <p className="font-medium truncate">Install DOTCOM</p>
          ) : (
            <p className="text-xs">
              Tap{' '}
              <Share size={13} className="inline-block -mt-0.5 text-blue-600 dark:text-blue-400" />{' '}
              then <span className="font-semibold">Add to Home Screen</span> to install
            </p>
          )}
        </div>

        {mode === 'android' && (
          <button
            onClick={install}
            className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            <Download size={14} />
            Install
          </button>
        )}

        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
