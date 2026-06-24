import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { QrDisplay } from '@/components/QrDisplay'
import { LiveStatusBadge } from '@/components/LiveStatusBadge'
import { LocationToggle } from '@/components/LocationToggle'
import { ChangePassword } from '@/components/ChangePassword'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TourButton } from '@/components/TourButton'
import { Logo } from '@/components/Logo'
import { AdminViewGate } from '@/components/AdminViewGate'
import { ContactPanitia } from '@/components/ContactPanitia'
import type { Profile, MemberPrivate } from '@/types/database'
import { Armchair, MapPin, Users, Building2, LogOut } from 'lucide-react'

export default async function MePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  // Own sensitive fields (qr_token, NIM) live in member_private — RLS allows own row.
  const { data: privData } = await supabase
    .from('member_private')
    .select('qr_token, student_id')
    .eq('id', user.id)
    .single()
  const priv = privData as Pick<MemberPrivate, 'qr_token' | 'student_id'> | null

  // Panitia (committee) contact directory. Phones live in member_private, which
  // members can't read via RLS, so resolve names/group/phone server-side with the
  // admin client and hand back only the committee contacts — never other PII.
  const admin = createAdminClient()
  const { data: committeeData } = await admin
    .from('profiles')
    .select('id, full_name, group_label')
    .eq('role', 'committee')
    .order('full_name')
  const committee = (committeeData ?? []) as Pick<Profile, 'id' | 'full_name' | 'group_label'>[]
  let panitia: { full_name: string; group_label: string | null; phone: string }[] = []
  if (committee.length) {
    const { data: privsData } = await admin
      .from('member_private')
      .select('id, phone')
      .in('id', committee.map(c => c.id))
      .not('phone', 'is', null)
    const privs = (privsData ?? []) as Pick<MemberPrivate, 'id' | 'phone'>[]
    const phoneById = new Map(privs.map(p => [p.id, p.phone] as const))
    panitia = committee
      .filter(c => phoneById.get(c.id))
      .map(c => ({ full_name: c.full_name, group_label: c.group_label, phone: phoneById.get(c.id)! }))
  }

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  // Initials for the avatar (first + last word, max two letters).
  const initials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const quickLinks = [
    { href: '/buses',  label: 'Bus Seats', icon: Armchair,  color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' },
    { href: '/map',    label: 'Live Map',  icon: MapPin,    color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30' },
    { href: '/groups', label: 'Groups',    icon: Users,     color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30' },
    { href: '/rooms',  label: 'Rooms',     icon: Building2,  color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
  ]

  return (
    <div className="min-h-screen px-4 py-6 pb-28">
      <div className="max-w-sm mx-auto w-full space-y-4">
        {/* Top bar: logo on the left, tour / theme / admin switch on the right */}
        <div className="flex items-center justify-between gap-1">
          <Logo size="bar" />
          <div className="flex items-center gap-1">
          {/* Mobile only — on desktop the switch lives in the top nav (DesktopNav). */}
          {profile.role === 'committee' && (
            <div className="mr-1 md:hidden"><AdminViewGate variant="chip" /></div>
          )}
          <TourButton tourId="member" />
          <ThemeToggle />
          </div>
        </div>

        {/* Identity + QR — the centerpiece card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <div className="h-24 bg-gradient-to-br from-blue-500 via-indigo-500 to-indigo-600" />
          <div className="px-6 pb-6 -mt-12 flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-3xl border-4 border-white dark:border-slate-800 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 shadow-md flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-200">{initials}</span>
            </div>

            <h1 id="onb-member-header" className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
              {profile.full_name}
            </h1>
            {profile.group_label && (
              <p className="text-slate-500 text-sm mt-0.5">{profile.group_label}</p>
            )}

            <div id="onb-status" className="mt-3">
              <LiveStatusBadge id={profile.id} initialStatus={profile.status} />
            </div>

            {priv?.student_id && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-700/60 rounded-full px-3 py-1">
                <span className="text-slate-400">NIM</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 tabular-nums">{priv.student_id}</span>
              </div>
            )}

            {/* QR */}
            <div id="onb-qr" className="mt-6 w-full flex flex-col items-center border-t border-slate-100 dark:border-slate-700/60 pt-6">
              {priv?.qr_token && <QrDisplay token={priv.qr_token} />}
              <p className="text-slate-500 text-xs mt-3">Show this QR to the bus committee at boarding</p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2.5">
          {quickLinks.map(({ href, label, icon: Icon, color }) => (
            <a key={href} href={href}
              className="group flex flex-col items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm rounded-2xl py-4 transition">
              <span className={`w-10 h-10 rounded-full flex items-center justify-center transition group-hover:scale-105 ${color}`}>
                <Icon size={18} />
              </span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
            </a>
          ))}
        </div>

        {/* Settings: location sharing + password */}
        <div className="space-y-3">
          <div id="onb-location-toggle">
            <LocationToggle initialSharing={profile.location_sharing} />
          </div>
          <ChangePassword />
        </div>

        {/* Contact panitia (committee) */}
        <ContactPanitia contacts={panitia} />

        {/* Sign out */}
        <div className="pt-2 flex flex-col items-center gap-3">
          <form action={signOut}>
            <button type="submit" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition">
              <LogOut size={14} />
              Sign out
            </button>
          </form>
          <p className="text-slate-400 dark:text-slate-700 text-xs">DOTA Companion</p>
        </div>
      </div>
    </div>
  )
}
