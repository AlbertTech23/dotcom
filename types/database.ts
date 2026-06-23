export type Role = 'admin' | 'member' | 'committee'
export type Status = 'on_bus' | 'off_bus'
export type LogAction = 'out' | 'in'

export interface Room {
  id: string
  name: string
  floor: string | null
  notes: string | null
  capacity: number | null
  created_at: string
}

export interface Profile {
  id: string
  full_name: string
  role: Role
  group_label: string | null
  photo_url: string | null
  status: Status
  // Sensitive PII — lives in member_private, not profiles. Present only when the
  // caller is allowed to see it (own row, or admin/committee) and merged in via
  // mergePrivate(). Optional so member-facing roster rows that omit them typecheck.
  student_id?: string | null
  phone?: string | null
  qr_token?: string | null
  bus_number: 1 | 2 | null
  seat_number: number | null
  room_id: string | null
  latitude: number | null
  longitude: number | null
  location_sharing: boolean
  location_updated_at: string | null
  last_changed_at: string | null
  created_at: string
}

export interface MemberPrivate {
  id: string
  student_id: string | null
  phone: string | null
  qr_token: string
}

export interface StatusLog {
  id: string
  member_id: string
  action: LogAction
  changed_by: string
  created_at: string
}

export type MarkerVisibility = 'public' | 'private'

export interface MapMarker {
  id: string
  label: string
  icon: string
  latitude: number
  longitude: number
  visibility: MarkerVisibility
  source_url: string | null
  created_by: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; full_name: string }
        Update: Partial<Profile>
      }
      member_private: {
        Row: MemberPrivate
        Insert: Partial<MemberPrivate> & { id: string }
        Update: Partial<MemberPrivate>
      }
      status_logs: {
        Row: StatusLog
        Insert: Omit<StatusLog, 'id' | 'created_at'>
      }
      rooms: {
        Row: Room
        Insert: Partial<Room> & { name: string }
        Update: Partial<Room>
      }
      map_markers: {
        Row: MapMarker
        Insert: Partial<MapMarker> & { label: string; latitude: number; longitude: number }
        Update: Partial<MapMarker>
      }
    }
  }
}
