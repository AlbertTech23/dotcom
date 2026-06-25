import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { parseBody, serverError } from '@/lib/api'
import { groupCreateSchema, groupReassignSchema, groupRenameSchema, groupDeleteSchema } from '@/lib/schemas'

// POST /api/admin/groups — create a group (registry row, so it persists empty)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, groupCreateSchema)
  if ('res' in parsed) return parsed.res
  const { name } = parsed.data

  const { error } = await supabase.from('groups').upsert({ name }, { onConflict: 'name' })
  if (error) return serverError('groups.create', error)
  return NextResponse.json({ ok: true }, { status: 201 })
}

// PATCH /api/admin/groups — reassign a single member's group_label
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, groupReassignSchema)
  if ('res' in parsed) return parsed.res
  const { memberId, groupLabel } = parsed.data

  const { error } = await supabase
    .from('profiles')
    .update({ group_label: groupLabel?.trim() || null })
    .eq('id', memberId)

  if (error) return serverError('groups.reassign', error)
  return NextResponse.json({ ok: true })
}

// PUT /api/admin/groups — rename a group (updates all members with old label)
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, groupRenameSchema)
  if ('res' in parsed) return parsed.res
  const { oldLabel, newLabel } = parsed.data

  // Rename the registry row and every member carrying the old label.
  await supabase.from('groups').update({ name: newLabel }).eq('name', oldLabel)
  const { error } = await supabase
    .from('profiles')
    .update({ group_label: newLabel })
    .eq('group_label', oldLabel)

  if (error) return serverError('groups.rename', error)
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/groups — remove a group (sets group_label to null for all members)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, groupDeleteSchema)
  if ('res' in parsed) return parsed.res
  const { label } = parsed.data

  // Remove the registry row and clear the label from any members in it.
  await supabase.from('groups').delete().eq('name', label)
  const { error } = await supabase
    .from('profiles')
    .update({ group_label: null })
    .eq('group_label', label)

  if (error) return serverError('groups.delete', error)
  return NextResponse.json({ ok: true })
}
