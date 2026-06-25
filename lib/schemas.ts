import { z } from 'zod'

// Shared request-body schemas (L5). Every API route validates its body against
// one of these before touching the database. Keep these in sync with the columns
// in supabase/schema.sql.

export const TRAVEL_MODES = ['bus', 'advance', 'convoy'] as const
export const ASSIGNABLE_ROLES = ['committee', 'member'] as const

const lat = z.number().min(-90).max(90)
const lng = z.number().min(-180).max(180)
const uuid = z.uuid()

// trims and rejects empty strings; use for required free text like names
const nonEmpty = z.string().trim().min(1)
// optional free text that may be cleared to null
const optText = z.string().trim().nullish()

// ── Members ────────────────────────────────────────────────────────────────
export const memberCreateSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: nonEmpty,
  student_id: optText,
  phone: optText,
  group_label: optText,
  room_id: uuid.nullish(),
  role: z.enum(['committee', 'member']).optional(),
  travel_mode: z.enum(TRAVEL_MODES).optional(),
})

export const memberPatchSchema = z.object({
  full_name: nonEmpty.optional(),
  group_label: optText,
  room_id: uuid.nullish(),
  travel_mode: z.enum(TRAVEL_MODES).optional(),
  student_id: optText,
  phone: optText,
})

export const importSchema = z.object({
  members: z.array(z.object({
    email: z.string(),
    password: z.string(),
    full_name: z.string(),
    student_id: z.string().optional(),
    phone: z.string().optional(),
    group_label: z.string().optional(),
    role: z.string().optional(),
    travel_mode: z.string().optional(),
  })).min(1, 'members array is required and must not be empty'),
})

export const roleSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES, { message: 'Role must be member or committee' }),
})

// ── Seats ──────────────────────────────────────────────────────────────────
export const seatAssignSchema = z.object({
  memberId: uuid,
  busNumber: z.literal([1, 2]),
  seatNumber: z.number().int().min(1).max(31),
})
export const seatUnassignSchema = z.object({ memberId: uuid })

// ── Rooms ──────────────────────────────────────────────────────────────────
export const roomCreateSchema = z.object({
  name: nonEmpty,
  floor: optText,
  notes: optText,
  capacity: z.number().int().positive().nullish(),
})
export const roomPatchSchema = z.object({
  name: nonEmpty.optional(),
  floor: optText,
  notes: optText,
  capacity: z.number().int().positive().nullish(),
})
export const roomAssignSchema = z.object({
  memberId: uuid,
  roomId: uuid.nullish(),
})

// ── Groups ─────────────────────────────────────────────────────────────────
export const groupCreateSchema = z.object({ name: nonEmpty })
export const groupReassignSchema = z.object({ memberId: uuid, groupLabel: optText })
export const groupRenameSchema = z.object({ oldLabel: nonEmpty, newLabel: nonEmpty })
export const groupDeleteSchema = z.object({ label: nonEmpty })

// ── Map markers ──────────────────────────────────────────────────────────────
export const markerCreateSchema = z.object({
  label: nonEmpty,
  icon: z.string().optional(),
  latitude: lat,
  longitude: lng,
  visibility: z.enum(['public', 'private']).optional(),
  source_url: z.string().nullish(),
})
export const markerPatchSchema = z.object({
  label: nonEmpty.optional(),
  icon: z.string().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  latitude: lat.optional(),
  longitude: lng.optional(),
  source_url: z.string().nullish(),
}).refine(o => Object.keys(o).length > 0, { message: 'Nothing to update' })

// ── Location ──────────────────────────────────────────────────────────────────
export const locationUpdateSchema = z.object({ latitude: lat, longitude: lng })
export const locationShareSchema = z.object({ sharing: z.boolean() })

// ── Routing / maps ───────────────────────────────────────────────────────────
const point = z.object({ lat: z.number(), lng: z.number() })
export const routeSchema = z.object({ start: point, end: point })
export const mapsResolveSchema = z.object({ url: z.string().min(1, 'Paste a Google Maps link') })

// ── Scan ──────────────────────────────────────────────────────────────────────
export const scanSchema = z.object({ qr_token: uuid })
