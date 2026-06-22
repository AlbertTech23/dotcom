'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { QrDisplay } from '@/components/QrDisplay'
import { Home, Users, Building2, ScanLine, QrCode, Armchair, MapPin, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  isStaff: boolean
  homeHref: string
  qrToken?: string | null
}

/**
 * Mobile-style bottom navigation (BCA-banking pattern): five slots with an
 * elevated, circular center action. Staff get Scan QR in the center; members get
 * "My QR" (shows their personal code). Rendered globally for authenticated users.
 */
export function BottomNav({ isStaff, homeHref, qrToken }: Props) {
  const pathname = usePathname()
  const [membersOpen, setMembersOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  // Close the Members popover whenever the route changes.
  useEffect(() => { setMembersOpen(false) }, [pathname])

  const homeActive = isStaff
    ? (pathname === '/dashboard' || pathname.startsWith('/dashboard/members'))
    : pathname === '/me'
  const membersActive = pathname.startsWith('/groups') || pathname.startsWith('/rooms')
  const scanActive = pathname.startsWith('/dashboard/scan')
  const busActive = pathname.startsWith('/buses')
  const mapActive = pathname.startsWith('/map')

  return (
    <>
      {/* Backdrop to dismiss the Members popover (sits below the nav bar) */}
      {membersOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMembersOpen(false)}
          className="fixed inset-0 z-[600] cursor-default"
        />
      )}

      {/* Member "My QR" modal */}
      {qrOpen && qrToken && (
        <div
          onClick={() => setQrOpen(false)}
          className="fixed inset-0 z-[1200] flex flex-col items-center justify-center gap-4 bg-slate-900/80 backdrop-blur-sm px-6"
        >
          <div
            onClick={e => e.stopPropagation()}
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

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-[700] pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="relative mx-auto max-w-lg pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800">
          {/* Members popover */}
          {membersOpen && (
            <div className="absolute bottom-full mb-3 left-3 z-[700] w-44 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-1.5">
              <Link href="/groups" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                <Users size={18} className="text-purple-500 dark:text-purple-400" />Groups
              </Link>
              <Link href="/rooms" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                <Building2 size={18} className="text-amber-500 dark:text-amber-400" />Rooms
              </Link>
            </div>
          )}

          <div className="flex items-stretch h-16">
            <Tab icon={Home} label="Home" href={homeHref} active={homeActive} />
            <Tab icon={Users} label="Members" active={membersActive || membersOpen} onClick={() => setMembersOpen(o => !o)} />

            {/* Elevated center action */}
            <div className="flex-1 flex flex-col items-center justify-end pb-1">
              {isStaff ? (
                <Link
                  id="onb-scan-nav"
                  href="/dashboard/scan"
                  aria-label="Scan QR"
                  className={`-mt-7 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-600/30 ring-4 ring-white dark:ring-slate-900 transition active:scale-95 ${
                    scanActive ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  <ScanLine size={24} />
                </Link>
              ) : (
                <button
                  onClick={() => setQrOpen(true)}
                  aria-label="My QR"
                  className="-mt-7 w-14 h-14 rounded-full flex items-center justify-center text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 ring-4 ring-white dark:ring-slate-900 transition active:scale-95"
                >
                  <QrCode size={24} />
                </button>
              )}
              <span className={`text-[10px] font-semibold mt-0.5 ${scanActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {isStaff ? 'Scan' : 'My QR'}
              </span>
            </div>

            <Tab icon={Armchair} label="Bus" href="/buses" active={busActive} />
            <Tab icon={MapPin} label="Map" href="/map" active={mapActive} />
          </div>
        </div>
      </nav>
    </>
  )
}

function Tab({
  icon: Icon,
  label,
  href,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  href?: string
  active?: boolean
  onClick?: () => void
}) {
  const cls = `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
    active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
  }`
  const inner = (
    <>
      <Icon size={20} />
      <span>{label}</span>
    </>
  )
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{inner}</button>
  )
}
