import type { Status } from '@/types/database'

export function statusLabel(s: Status) {
  return s === 'on_bus' ? 'On Bus' : 'Off Bus'
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Convert Indonesian phone numbers to WhatsApp-compatible international format.
 *  08xx... → 628xx...   +628xx... → 628xx...   628xx... → unchanged */
export function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0'))  return '62' + digits.slice(1)
  if (digits.startsWith('62')) return digits
  return '62' + digits
}
