import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MemberForm } from '@/components/MemberForm'
import { StatusBadge } from '@/components/StatusBadge'
import { RoleSelector } from '@/components/RoleSelector'
import { DeleteMemberButton } from '@/components/DeleteMemberButton'
import { formatTime, toWaNumber } from '@/lib/utils'
import type { Profile, MemberPrivate, Room } from '@/types/database'
import { ChevronLeft, ChevronRight, CheckCircle2, LogOut as LogOutIcon, Armchair } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profileData } = await supabase.from('profiles').select('*').eq('id', id).single()
  const profile = profileData as Profile | null
  if (!profile) notFound()

  // Sensitive fields live in member_private; admins/committee may read any row.
  const { data: privData } = await supabase
    .from('member_private')
    .select('student_id, phone, qr_token')
    .eq('id', id)
    .single()
  const priv = privData as Pick<MemberPrivate, 'student_id' | 'phone' | 'qr_token'> | null
  // Merged view for the edit form, which expects student_id/phone on the profile.
  const profileForForm = { ...profile, ...(priv ?? {}) }

  // Rooms + distinct group labels for the form's dropdowns.
  const [{ data: roomsData }, { data: groupRows }] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('profiles').select('group_label'),
  ])
  const rooms = (roomsData ?? []) as Room[]
  const groups = Array.from(
    new Set(((groupRows ?? []) as { group_label: string | null }[])
      .map(r => r.group_label)
      .filter((g): g is string => !!g)),
  ).sort()

  // Only true admins may assign roles (committee can view this page but not change
  // roles — the API enforces this; we hide the control to match).
  const { data: { user } } = await supabase.auth.getUser()
  const { data: viewerData } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  const viewerIsAdmin = (viewerData as Pick<Profile, 'role'> | null)?.role === 'admin'

  const { data: logs } = await supabase
    .from('status_logs')
    .select('*')
    .eq('member_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  async function deleteMember() {
    'use server'
    const admin = createAdminClient()
    await admin.auth.admin.deleteUser(id)
    redirect('/dashboard')
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm">
          <ChevronLeft size={16} />Back
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{profile.full_name}</h1>
        <StatusBadge status={profile.status} />
      </div>

      {/* Jump straight to this member's seat on the bus map (no manual hunting).
          Seated → spotlight their seat; unseated → hand them to the map to place. */}
      <Link
        href={profile.seat_number && profile.bus_number
          ? `/buses?bus=${profile.bus_number}&seat=${profile.seat_number}`
          : `/buses?place=${id}${profile.bus_number ? `&bus=${profile.bus_number}` : ''}`}
        className="group flex items-center justify-between gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl px-4 py-3 transition"
      >
        <span className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <Armchair size={16} />
          </span>
          {profile.seat_number && profile.bus_number
            ? `View seat — Bus ${profile.bus_number}, seat ${profile.seat_number}`
            : 'Assign a seat on the bus'}
        </span>
        <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500 transition flex-shrink-0" />
      </Link>

      {/* Edit form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Edit Info</h2>
        <MemberForm mode="edit" profile={profileForForm} rooms={rooms} groups={groups} />
      </div>

      {/* Role assignment — admin only */}
      {viewerIsAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <RoleSelector memberId={id} currentRole={profile.role as 'admin' | 'committee' | 'member'} />
        </div>
      )}

      {/* QR token + WhatsApp */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="text-xs text-slate-400 break-all">
          <span className="font-semibold text-slate-500">QR Token: </span>{priv?.qr_token ?? '—'}
        </div>
        {priv?.phone && (
          <a
            href={`https://wa.me/${toWaNumber(priv.phone)}?text=${encodeURIComponent(`Halo ${profile.full_name}, ini dari panitia ACES DOTA REBOOT 2026 😊`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.858L0 24l6.336-1.508A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 01-4.988-1.362l-.358-.213-3.76.896.952-3.653-.234-.374A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
            </svg>
            Chat on WhatsApp
          </a>
        )}
      </div>

      {/* Activity log */}
      {logs && logs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Recent Activity</h2>
          {logs.map(log => (
            <div key={log.id} className="flex items-center justify-between text-sm">
              <span className={log.action === 'out' ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}>
                <span className="flex items-center gap-1">
                  {log.action === 'out'
                    ? <><LogOutIcon size={13} />Left bus</>
                    : <><CheckCircle2 size={13} />Back on bus</>
                  }
                </span>
              </span>
              <span className="text-slate-400 text-xs">{formatTime(log.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Delete */}
      <DeleteMemberButton action={deleteMember} name={profile.full_name} />
    </div>
  )
}
