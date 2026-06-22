import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// POST /api/admin/groups — create a group (registry row, so it persists empty)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Group name is required' }, { status: 400 })

  const { error } = await supabase.from('groups').upsert({ name: name.trim() }, { onConflict: 'name' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

// PATCH /api/admin/groups — reassign a single member's group_label
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { memberId, groupLabel } = await req.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const { error } = await supabase
    .from('profiles')
    .update({ group_label: groupLabel?.trim() || null })
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT /api/admin/groups — rename a group (updates all members with old label)
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { oldLabel, newLabel } = await req.json()
  if (!oldLabel || !newLabel?.trim()) return NextResponse.json({ error: 'oldLabel and newLabel required' }, { status: 400 })

  // Rename the registry row and every member carrying the old label.
  await supabase.from('groups').update({ name: newLabel.trim() }).eq('name', oldLabel)
  const { error } = await supabase
    .from('profiles')
    .update({ group_label: newLabel.trim() })
    .eq('group_label', oldLabel)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/groups — remove a group (sets group_label to null for all members)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { label } = await req.json()
  if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 })

  // Remove the registry row and clear the label from any members in it.
  await supabase.from('groups').delete().eq('name', label)
  const { error } = await supabase
    .from('profiles')
    .update({ group_label: null })
    .eq('group_label', label)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
