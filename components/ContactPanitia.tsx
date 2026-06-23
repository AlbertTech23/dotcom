'use client'
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { toWaNumber } from '@/lib/utils'
import { Headset, X, Copy, Search } from 'lucide-react'

export interface PanitiaContact {
  full_name: string
  group_label: string | null
  phone: string
}

/** Initials for the avatar — first + last word, max two letters. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Members' "Hubungi Panitia" directory: a button that opens a modal listing the
 * committee (panitia) with WhatsApp + copy-number actions. Contacts are resolved
 * server-side (see /me) — this component only renders what it's handed. Renders
 * nothing when there are no contactable panitia, so there's never a dead button.
 */
export function ContactPanitia({ contacts }: { contacts: PanitiaContact[] }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  useEffect(() => { setMounted(true) }, [])

  const showSearch = contacts.length > 7
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(c =>
      c.full_name.toLowerCase().includes(q) || (c.group_label ?? '').toLowerCase().includes(q),
    )
  }, [contacts, query])

  if (contacts.length === 0) return null

  async function copy(phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      toast.success('Nomor disalin')
    } catch {
      toast.error('Gagal menyalin nomor')
    }
  }

  function waHref(c: PanitiaContact) {
    const firstName = c.full_name.split(/\s+/)[0]
    const text = `Halo Kak ${firstName}, saya peserta ACES DOTA REBOOT 2026 mau bertanya \u{1F60A}`
    return `https://wa.me/${toWaNumber(c.phone)}?text=${encodeURIComponent(text)}`
  }

  const modal = (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-slate-900/80 backdrop-blur-sm sm:px-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Headset size={16} className="text-emerald-500" />
            Hubungi Panitia
          </h2>
          <button onClick={() => setOpen(false)} aria-label="Tutup" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Pilih panitia untuk dihubungi lewat WhatsApp.</p>

        {showSearch && (
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari nama atau grup"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 divide-y divide-slate-100 dark:divide-slate-700/60">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Tidak ada panitia yang cocok.</p>
          ) : (
            filtered.map((c, i) => (
              <div key={`${c.full_name}-${i}`} className="flex items-center gap-3 py-3">
                <span className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {initials(c.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{c.full_name}</span>
                    <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded px-1.5 py-0.5">Panitia</span>
                  </div>
                  {c.group_label && <span className="block text-xs text-slate-400 truncate">{c.group_label}</span>}
                </div>
                <button
                  onClick={() => copy(c.phone)}
                  aria-label={`Salin nomor ${c.full_name}`}
                  className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <Copy size={15} />
                </button>
                <a
                  href={waHref(c)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp ${c.full_name}`}
                  className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.858L0 24l6.336-1.508A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 01-4.988-1.362l-.358-.213-3.76.896.952-3.653-.234-.374A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                  </svg>
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 w-full border border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-500 dark:hover:border-emerald-700 text-emerald-700 dark:text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-sm font-medium py-2.5 rounded-xl transition"
      >
        <Headset size={16} />
        Hubungi Panitia
      </button>
      {open && mounted && createPortal(modal, document.body)}
    </>
  )
}
