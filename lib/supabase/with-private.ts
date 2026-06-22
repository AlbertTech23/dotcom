import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, MemberPrivate } from '@/types/database'

type PrivateFields = Pick<Profile, 'student_id' | 'phone' | 'qr_token'>

// The project's @supabase/ssr client carries extra generics that don't line up
// with the default SupabaseClient signature (a known version skew in this repo).
// We only need `.from()`, so accept any client shape that provides it.
type AnyClient = Pick<SupabaseClient, 'from'>

/**
 * Merge member_private fields (student_id, phone, qr_token) into a list of
 * profile rows by id.
 *
 * RLS on member_private does the access control for us: admins/committee get a
 * row for every id, while a plain member gets back only their own row. So after
 * the merge, members see PII on their own row and nothing on anyone else's —
 * exactly the "roster + own private data" policy — without any role branching here.
 *
 * Pass the RLS-bound server client (lib/supabase/server), NOT the admin client.
 */
export async function mergePrivate<T extends { id: string }>(
  supabase: AnyClient,
  rows: T[],
): Promise<(T & Partial<PrivateFields>)[]> {
  if (rows.length === 0) return rows
  const ids = rows.map(r => r.id)
  const { data } = await supabase
    .from('member_private')
    .select('id, student_id, phone, qr_token')
    .in('id', ids)

  const priv = (data ?? []) as MemberPrivate[]
  const byId = new Map(priv.map(d => [d.id, d]))
  return rows.map(r => {
    const p = byId.get(r.id)
    return p
      ? { ...r, student_id: p.student_id, phone: p.phone, qr_token: p.qr_token }
      : r
  })
}
