'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/Logo'
import { QrDisplay } from '@/components/QrDisplay'
import { NavLocationToggle } from '@/components/NavLocationToggle'
import { TourButton } from '@/components/TourButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AdminViewGate } from '@/components/AdminViewGate'
import { exitAdminView } from '@/app/actions/admin-view'
import { Home, Armchair, MapPin, Users, Building2, ScanLine, QrCode, UserPlus, LogOut, X, UserCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  isStaff: boolean
  homeHref: string
  qrToken?: string | null
  locationSharing: boolean
  /** Committee get a control to switch between personal and admin views. */
  isCommittee?: boolean
  adminView?: boolean
}

/**
 * Desktop-only top navigation (md and up). The floating bottom bar is hidden on
 * desktop; this is the single top bar shown on every authenticated page. It folds
 * in the staff actions (scan, add member) and the shared utilities (location,
 * tour, theme, sign out) so there's exactly one bar on desktop.
 */
export function DesktopNav({ isStaff, homeHref, qrToken, locationSharing, isCommittee, adminView }: Props) {
  const pathname = usePathname()
  const [qrOpen, setQrOpen] = useState(false)

  // Carry the onboarding-tour anchor IDs (#onb-scan-nav / #onb-add-member) only
  // while this desktop bar is actually visible. The mobile bars keep the same IDs;
  // gating here lets querySelector resolve to whichever copy is on-screen.
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const links: { href: string; label: string; icon: LucideIcon; active: boolean }[] = [
    {
      href: homeHref,
      label: 'Home',
      icon: Home,
      active: isStaff
        ? pathname === '/dashboard' || pathname.startsWith('/dashboard/members')
        : pathname === '/me',
    },
    { href: '/buses', label: 'Bus', icon: Armchair, active: pathname.startsWith('/buses') },
    { href: '/map', label: 'Map', icon: MapPin, active: pathname.startsWith('/map') },
    { href: '/groups', label: 'Groups', icon: Users, active: pathname.startsWith('/groups') },
    { href: '/rooms', label: 'Rooms', icon: Building2, active: pathname.startsWith('/rooms') },
  ]

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Full reload so the root layout re-renders without auth and the nav clears.
    window.location.assign('/login')
  }

  return (
    <>
    <header className="hidden md:block sticky top-0 z-[700] bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href={homeHref} className="flex items-center flex-shrink-0">
          <Logo size="bar" />
        </Link>

        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isStaff ? (
            <>
              <Link
                href="/dashboard/scan"
                id={isDesktop ? 'onb-scan-nav' : undefined}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <ScanLine size={16} />
                Scan
              </Link>
              <Link
                href="/dashboard/members/new"
                id={isDesktop ? 'onb-add-member' : undefined}
                title="Add member"
                className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 hover:border-slate-400 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-semibold px-2.5 py-1.5 rounded-lg transition"
              >
                <UserPlus size={16} />
              </Link>
            </>
          ) : (
            qrToken && (
              <button
                onClick={() => setQrOpen(true)}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <QrCode size={16} />
                My QR
              </button>
            )
          )}

          {isCommittee && (
            adminView ? (
              <form action={exitAdminView}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  <UserCircle size={13} />
                  Personal View
                </button>
              </form>
            ) : (
              <AdminViewGate variant="chip" />
            )
          )}

          <NavLocationToggle initialSharing={locationSharing} />
          <TourButton tourId={isStaff ? 'admin' : 'member'} />
          <ThemeToggle />
          <button
            onClick={signOut}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
      </header>

      {/* My QR modal (member) — rendered outside the backdrop-blur <header> so
          `fixed inset-0` resolves against the viewport, not the header's box
          (backdrop-filter establishes a containing block for fixed descendants). */}
      {qrOpen && qrToken && (
        <div
          onClick={() => setQrOpen(false)}
          className="fixed inset-0 z-[1200] flex flex-col items-center justify-center gap-4 bg-slate-900/80 backdrop-blur-sm px-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 flex flex-col items-center gap-4 shadow-2xl"
          >
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Show this to the committee</p>
            <QrDisplay token={qrToken} />
            <button
              onClick={() => setQrOpen(false)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
            >
              <X size={15} />Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
