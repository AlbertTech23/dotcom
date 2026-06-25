'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react'

/**
 * Bulk member import from an .xlsx roster.
 *
 * Convention (matches single-member create): a member signs in with their NIM
 * (student_id) as the initial password, so the sheet has NO password column —
 * student_id is required and becomes the password.  xlsx is loaded dynamically
 * because it pulls in browser-only APIs and is heavy.
 */

// Canonical column keys + the header aliases we accept (case-insensitive, trimmed).
const COLUMNS = [
  { key: 'email',       label: 'email',       required: true,  aliases: ['email', 'e-mail', 'mail'] },
  { key: 'full_name',   label: 'full_name',   required: true,  aliases: ['full_name', 'full name', 'name', 'nama'] },
  { key: 'student_id',  label: 'student_id',  required: true,  aliases: ['student_id', 'studentid', 'nim', 'student id'] },
  { key: 'phone',       label: 'phone',       required: false, aliases: ['phone', 'hp', 'no_hp', 'telepon', 'whatsapp', 'wa'] },
  { key: 'group_label', label: 'group_label', required: false, aliases: ['group_label', 'group', 'kelompok', 'grup'] },
  { key: 'role',        label: 'role',        required: false, aliases: ['role', 'peran'] },
] as const

type Key = (typeof COLUMNS)[number]['key']

interface ParsedRow {
  rowNumber: number               // 1-based row in the sheet (for error messages)
  email: string
  full_name: string
  student_id: string
  phone: string
  group_label: string
  role: string
  errors: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  /** Only true admins may set role=committee via import (committee can't escalate). */
  canAssignRole: boolean
}

export function MemberImport({ canAssignRole }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ created: number; failed: number; errors: { email: string; error: string }[] } | null>(null)

  const valid = rows.filter(r => r.errors.length === 0)
  const invalid = rows.filter(r => r.errors.length > 0)

  async function downloadTemplate() {
    // xlsx-js-style is a drop-in fork of xlsx that actually writes cell styles
    // (the plain xlsx writer silently drops them).
    const XLSX = (await import('xlsx-js-style')).default

    // Palette (hex, no #) — required columns read as blue, optional as muted slate.
    const C = { blue: '2563EB', slate: '64748B', slateBg: 'E2E8F0', white: 'FFFFFF', ink: '1E293B', red: 'DC2626', faint: '94A3B8', headBg: '334155' }
    const thin = { style: 'thin', color: { rgb: 'CBD5E1' } }
    const border = { top: thin, bottom: thin, left: thin, right: thin }
    const set = (ws: Record<string, { s?: unknown }>, addr: string, s: unknown) => { if (ws[addr]) ws[addr].s = s }

    // ── Sheet 1: the roster (header + one example row to copy) ──
    const header = COLUMNS.map(c => c.label)
    const example = ['john.doe@students.umn.ac.id', 'John Doe', '00000012345', '08123456789', 'Alpha', 'member']
    const ws = XLSX.utils.aoa_to_sheet([header, example])
    ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }]
    ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(COLUMNS.length - 1)}1` }

    // Header row: required = solid blue + white, optional = light slate + dark.
    COLUMNS.forEach((col, c) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c })
      set(ws, addr, {
        font: { bold: true, sz: 11, color: { rgb: col.required ? C.white : C.ink } },
        fill: { patternType: 'solid', fgColor: { rgb: col.required ? C.blue : C.slateBg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border,
      })
    })
    // Example row: faint + italic so it's obviously a placeholder to delete.
    COLUMNS.forEach((_, c) => {
      const addr = XLSX.utils.encode_cell({ r: 1, c })
      set(ws, addr, { font: { italic: true, color: { rgb: C.faint } }, border })
    })

    // ── Sheet 2: human-readable instructions ──
    const guide = [
      ['DOTCOM — Member Import Template'],
      [''],
      ['Fill the "Members" sheet, one member per row, then upload it on the Import page.'],
      ['Delete the example row before uploading.'],
      ['Legend:  blue = required · grey = optional'],
      [''],
      ['Column', 'Required?', 'What to put'],
      ['email', 'REQUIRED', 'Login email. Must be unique — duplicates are skipped.'],
      ['full_name', 'REQUIRED', 'Display name, e.g. John Doe.'],
      ['student_id', 'REQUIRED', 'NIM. Also becomes the initial password — the member signs in with their NIM and can change it later.'],
      ['phone', 'optional', 'Phone / WhatsApp number. Leave blank if unknown.'],
      ['group_label', 'optional', 'Group / cluster name. Leave blank for no group.'],
      ['role', 'optional', 'Leave blank or "member" for normal members. "committee" grants staff access (admin-only).'],
    ]
    const wsGuide = XLSX.utils.aoa_to_sheet(guide)
    wsGuide['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 80 }]
    wsGuide['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]

    set(wsGuide, 'A1', { font: { bold: true, sz: 14, color: { rgb: C.ink } } })
    set(wsGuide, 'A5', { font: { italic: true, color: { rgb: C.slate } } })
    // Table header row (index 6 → row 7).
    ;['A7', 'B7', 'C7'].forEach(addr => set(wsGuide, addr, {
      font: { bold: true, color: { rgb: C.white } },
      fill: { patternType: 'solid', fgColor: { rgb: C.headBg } },
      border,
    }))
    // Data rows (sheet rows 8–13): tint the column name + colour the Required? flag.
    COLUMNS.forEach((col, i) => {
      const r = 8 + i
      set(wsGuide, `A${r}`, {
        font: { bold: true, color: { rgb: col.required ? C.white : C.ink } },
        fill: { patternType: 'solid', fgColor: { rgb: col.required ? C.blue : C.slateBg } },
        border,
      })
      set(wsGuide, `B${r}`, { font: { bold: col.required, color: { rgb: col.required ? C.red : C.slate } }, border })
      set(wsGuide, `C${r}`, { alignment: { wrapText: true, vertical: 'top' }, border })
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Members')
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Instructions')
    XLSX.writeFile(wb, 'dotcom-member-template.xlsx')
  }

  function normalizeHeader(h: string): Key | null {
    const norm = String(h).trim().toLowerCase()
    for (const col of COLUMNS) {
      if ((col.aliases as readonly string[]).includes(norm)) return col.key
    }
    return null
  }

  async function onFile(file: File) {
    setParsing(true)
    setResults(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      // Read as arrays so we control header mapping ourselves.
      const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', blankrows: false })
      if (matrix.length < 2) {
        toast.error('No data rows found in the first sheet.')
        setRows([])
        return
      }

      // Map the header row to our canonical keys.
      const headerRow = matrix[0]
      const colIndex: Partial<Record<Key, number>> = {}
      headerRow.forEach((h, i) => {
        const key = normalizeHeader(h)
        if (key && colIndex[key] === undefined) colIndex[key] = i
      })

      const missingRequired = COLUMNS.filter(c => c.required && colIndex[c.key] === undefined)
      if (missingRequired.length) {
        toast.error(`Missing required column(s): ${missingRequired.map(c => c.label).join(', ')}`)
        setRows([])
        return
      }

      const cell = (r: string[], k: Key) => {
        const i = colIndex[k]
        return i === undefined ? '' : String(r[i] ?? '').trim()
      }

      const seenEmails = new Set<string>()
      const parsed: ParsedRow[] = matrix.slice(1)
        // Drop fully empty rows.
        .filter(r => r.some(c => String(c ?? '').trim() !== ''))
        .map((r, idx) => {
          const role = cell(r, 'role').toLowerCase()
          const row: ParsedRow = {
            rowNumber: idx + 2, // +2: 1-based, and row 1 is the header
            email: cell(r, 'email').toLowerCase(),
            full_name: cell(r, 'full_name'),
            student_id: cell(r, 'student_id'),
            phone: cell(r, 'phone'),
            group_label: cell(r, 'group_label'),
            role: role || 'member',
            errors: [],
          }

          if (!row.email) row.errors.push('email is required')
          else if (!EMAIL_RE.test(row.email)) row.errors.push('email looks invalid')
          else if (seenEmails.has(row.email)) row.errors.push('duplicate email in file')
          else seenEmails.add(row.email)

          if (!row.full_name) row.errors.push('full_name is required')

          if (!row.student_id) row.errors.push('student_id (NIM) is required — it is the password')
          else if (row.student_id.length < 6) row.errors.push('student_id must be at least 6 characters (used as password)')

          if (row.role !== 'member' && row.role !== 'committee') {
            row.errors.push(`unknown role "${row.role}" — use "member" or "committee"`)
          } else if (row.role === 'committee' && !canAssignRole) {
            row.errors.push('only an admin can import committee accounts')
          }

          return row
        })

      setRows(parsed)
      setFileName(file.name)
      if (parsed.length === 0) toast.error('No member rows found.')
    } catch (e) {
      toast.error('Could not read that file — is it a valid .xlsx?')
      console.error(e)
    } finally {
      setParsing(false)
    }
  }

  async function runImport() {
    if (valid.length === 0) return
    setImporting(true)
    setResults(null)
    try {
      const members = valid.map(r => ({
        email: r.email,
        password: r.student_id, // NIM is the initial password (app convention)
        full_name: r.full_name,
        student_id: r.student_id,
        phone: r.phone || undefined,
        group_label: r.group_label || undefined,
        role: r.role,
      }))

      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')

      setResults({ created: data.created, failed: data.failed, errors: data.errors ?? [] })
      if (data.created > 0) toast.success(`Imported ${data.created} member${data.created === 1 ? '' : 's'}`)
      if (data.failed > 0) toast.error(`${data.failed} row${data.failed === 1 ? '' : 's'} failed`)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setRows([])
    setFileName('')
    setResults(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-5">
      {/* Step 1: template */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">1 · Download the template</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <strong>email</strong>, <strong>full_name</strong> and <strong>student_id</strong> (NIM) are required.
              The NIM becomes each member’s initial password. <strong>phone</strong>, <strong>group_label</strong> and{' '}
              <strong>role</strong> are optional.
            </p>
          </div>
        </div>
        <button onClick={downloadTemplate}
          className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          <Download size={15} />Download .xlsx template
        </button>
      </div>

      {/* Step 2: upload */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-start gap-3">
          <Upload size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">2 · Upload your filled roster</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick the .xlsx file — rows are validated before anything is created.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx,.xls"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
            className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500 file:cursor-pointer" />
          {parsing && <span className="text-xs text-slate-400">Reading…</span>}
          {fileName && !parsing && (
            <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
              <X size={13} />Clear
            </button>
          )}
        </div>
      </div>

      {/* Step 3: preview + import */}
      {rows.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              3 · Preview <span className="text-slate-400 font-normal">({fileName})</span>
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />{valid.length} ready
              </span>
              {invalid.length > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={14} />{invalid.length} with issues
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Email</th>
                  <th className="px-2 py-1.5 font-medium">Name</th>
                  <th className="px-2 py-1.5 font-medium">NIM</th>
                  <th className="px-2 py-1.5 font-medium">Group</th>
                  <th className="px-2 py-1.5 font-medium">Role</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const ok = r.errors.length === 0
                  return (
                    <tr key={r.rowNumber} className="border-b border-slate-100 dark:border-slate-700/50 align-top">
                      <td className="px-2 py-1.5 text-slate-400">{r.rowNumber}</td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{r.email || <span className="text-slate-400">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{r.full_name || <span className="text-slate-400">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{r.student_id || <span className="text-slate-400">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{r.group_label || <span className="text-slate-400">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{r.role}</td>
                      <td className="px-2 py-1.5">
                        {ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={13} />Ready
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">{r.errors.join('; ')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={runImport} disabled={importing || valid.length === 0}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
              <Upload size={15} />{importing ? 'Importing…' : `Import ${valid.length} member${valid.length === 1 ? '' : 's'}`}
            </button>
            {invalid.length > 0 && (
              <span className="text-xs text-slate-400">{invalid.length} row{invalid.length === 1 ? '' : 's'} with issues will be skipped.</span>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Import results</h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />{results.created} created
            </span>
            {results.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-red-500">
                <AlertTriangle size={16} />{results.failed} failed
              </span>
            )}
          </div>
          {results.errors.length > 0 && (
            <ul className="text-xs text-slate-500 space-y-1">
              {results.errors.map((e, i) => (
                <li key={i}><span className="text-slate-700 dark:text-slate-300">{e.email}</span> — {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
