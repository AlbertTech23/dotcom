import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { QrDisplay } from '@/components/QrDisplay'
import { StatusBadge } from '@/components/StatusBadge'
import { LocationToggle } from '@/components/LocationToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TourButton } from '@/components/TourButton'
import { toWaNumber } from '@/lib/utils'
import type { Profile, MemberPrivate } from '@/types/database'
import { Armchair, MapPin, Users, Building2, LogOut, LayoutDashboard } from 'lucide-react'

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

  // Contact-committee button needs an admin's phone, which members can no longer
  // read (it's private). Resolve it server-side with the admin client and hand
  // back only that single contact — not the whole table.
  const admin = createAdminClient()
  const { data: adminsData } = await admin.from('profiles').select('id, full_name').eq('role', 'admin')
  const admins = (adminsData ?? []) as Pick<Profile, 'id' | 'full_name'>[]
  let adminContact: { full_name: string; phone: string } | null = null
  if (admins.length) {
    const { data: privsData } = await admin
      .from('member_private')
      .select('id, phone')
      .in('id', admins.map(a => a.id))
      .not('phone', 'is', null)
      .limit(1)
    const privs = (privsData ?? []) as Pick<MemberPrivate, 'id' | 'phone'>[]
    if (privs.length) {
      const a = admins.find(x => x.id === privs[0].id)
      if (a && privs[0].phone) adminContact = { full_name: a.full_name, phone: privs[0].phone }
    }
  }

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 pb-28 gap-6 max-w-sm mx-auto w-full">
      {/* Theme toggle + tour button + admin switch */}
      <div className="self-end flex items-center gap-1">
        {profile.role === 'committee' && (
          <a href="/dashboard"
            className="flex items-center gap-1.5 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs font-semibold px-3 py-1.5 rounded-lg transition mr-1">
            <LayoutDashboard size={13} />
            Admin View
          </a>
        )}
        <TourButton tourId="member" />
        <ThemeToggle />
      </div>

      {/* Header */}
      <div id="onb-member-header" className="text-center -mt-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{profile.full_name}</h1>
        {profile.group_label && (
          <p className="text-slate-500 text-sm mt-0.5">{profile.group_label}</p>
        )}
        <div id="onb-status" className="mt-2">
          <StatusBadge status={profile.status} />
        </div>
      </div>

      {/* QR Code */}
      <div id="onb-qr" className="text-center space-y-3">
        <p className="text-slate-500 text-sm">Show this QR to the bus committee</p>
        {priv?.qr_token && <QrDisplay token={priv.qr_token} />}
      </div>

      {/* Info */}
      {priv?.student_id && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm text-slate-700 dark:text-slate-300 w-full max-w-xs">
          <span className="text-slate-500">NIM: </span>{priv.student_id}
        </div>
      )}

      {/* Location sharing toggle */}
      <div id="onb-location-toggle" className="w-full">
        <LocationToggle initialSharing={profile.location_sharing} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2 w-full">
        <a href="/buses"
          className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium py-2.5 rounded-xl transition">
          <Armchair size={16} />Bus Seats
        </a>
        <a href="/map"
          className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium py-2.5 rounded-xl transition">
          <MapPin size={16} />Live Map
        </a>
        <a href="/groups"
          className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium py-2.5 rounded-xl transition">
          <Users size={16} />Groups
        </a>
        <a href="/rooms"
          className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium py-2.5 rounded-xl transition">
          <Building2 size={16} />Rooms
        </a>
      </div>

      {/* Contact admin */}
      {adminContact?.phone && (
        <a
          href={`https://wa.me/${toWaNumber(adminContact.phone)}?text=${encodeURIComponent('Halo panitia ACES DOTA REBOOT 2026, saya mau tanya 😊')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full border border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-500 dark:hover:border-emerald-700 text-emerald-700 dark:text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-sm font-medium py-2.5 rounded-xl transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.858L0 24l6.336-1.508A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 01-4.988-1.362l-.358-.213-3.76.896.952-3.653-.234-.374A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
          </svg>
          Contact Committee
        </a>
      )}

      {/* Sign out */}
      <form action={signOut}>
        <button type="submit" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition">
          <LogOut size={14} />
          Sign out
        </button>
      </form>

      <p className="text-slate-400 dark:text-slate-700 text-xs">DOTA Companion</p>
    </div>
  )
}
