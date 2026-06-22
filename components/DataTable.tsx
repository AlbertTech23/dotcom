'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type Column,
  type Row,
} from '@tanstack/react-table'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from './StatusBadge'
import { formatTime } from '@/lib/utils'
import type { Profile } from '@/types/database'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

// ─── Exports ──────────────────────────────────────────────────────────────────

function toExportRow(p: Profile) {
  return {
    Name:        p.full_name,
    NIM:         p.student_id ?? '',
    Group:       p.group_label ?? '',
    Status:      p.status === 'on_bus' ? 'On Bus' : 'Off Bus',
    Bus:         p.bus_number ? `Bus ${p.bus_number}` : '',
    Seat:        p.seat_number ?? '',
    'Last Changed': p.last_changed_at
      ? new Date(p.last_changed_at).toLocaleString('id-ID')
      : '',
  }
}

function exportCSV(rows: Profile[]) {
  const headers = ['Name', 'NIM', 'Group', 'Status', 'Bus', 'Seat', 'Last Changed']
  const lines = [
    headers.join(','),
    ...rows.map(p => {
      const r = toExportRow(p)
      return headers.map(h => {
        const v = String(r[h as keyof typeof r] ?? '')
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    }),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'members.csv'; a.click()
  URL.revokeObjectURL(url)
}

async function exportExcel(rows: Profile[]) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows.map(toExportRow))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Members')
  XLSX.writeFile(wb, 'members.xlsx')
}

// ─── Sort header button ────────────────────────────────────────────────────────

function SortHeader({ column, label }: { column: Column<Profile, unknown>; label: string }) {
  const sorted = column.getIsSorted()
  return (
    <button
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className="group flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition font-medium text-xs uppercase tracking-wide"
    >
      {label}
      <span className={sorted ? 'text-blue-500' : 'text-slate-400 opacity-50 group-hover:opacity-80'}>
        {sorted === 'asc'  ? <ChevronUp size={13} /> :
         sorted === 'desc' ? <ChevronDown size={13} /> :
         <ChevronsUpDown size={13} />}
      </span>
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DataTable({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [toggling,  setToggling]  = useState<string | null>(null)
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busFilter,    setBusFilter]    = useState('all')
  const [groupFilter,  setGroupFilter]  = useState('all')
  const [sorting, setSorting]     = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('datatable-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setProfiles(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as Profile : p))
        } else if (payload.eventType === 'INSERT') {
          setProfiles(prev => [...prev, payload.new as Profile])
        } else if (payload.eventType === 'DELETE') {
          setProfiles(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function toggle(id: string) {
    setToggling(id)
    await fetch(`/api/admin/toggle/${id}`, { method: 'POST' })
    setToggling(null)
  }

  const members = useMemo(() => profiles.filter(p => p.role === 'member'), [profiles])

  // Distinct group labels for filter dropdown
  const groups = useMemo(() => {
    const s = new Set<string>()
    members.forEach(p => { if (p.group_label?.trim()) s.add(p.group_label.trim()) })
    return [...s].sort()
  }, [members])

  // Pre-filter by dropdown filters (TanStack globalFilter handles text search on top)
  const displayData = useMemo(() => {
    let d = members
    if (statusFilter !== 'all') d = d.filter(p => p.status === statusFilter)
    if (busFilter    !== 'all') d = d.filter(p => String(p.bus_number ?? '') === busFilter)
    if (groupFilter  !== 'all') d = d.filter(p => (p.group_label ?? '') === groupFilter)
    return d
  }, [members, statusFilter, busFilter, groupFilter])

  // Reset to page 0 when any filter/search changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [globalFilter, statusFilter, busFilter, groupFilter])

  const columns = useMemo<ColumnDef<Profile>[]>(() => [
    {
      accessorKey: 'full_name',
      header: ({ column }) => <SortHeader column={column} label="Name" />,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/members/${row.original.id}`}
          className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          {row.original.full_name}
        </Link>
      ),
    },
    {
      accessorKey: 'student_id',
      header: ({ column }) => <SortHeader column={column} label="NIM" />,
      cell: ({ getValue }) => (
        <span className="text-slate-500 dark:text-slate-400 text-sm">{(getValue() as string) ?? '—'}</span>
      ),
      enableGlobalFilter: false,
    },
    {
      accessorKey: 'group_label',
      header: ({ column }) => <SortHeader column={column} label="Group" />,
      cell: ({ getValue }) => (
        <span className="text-slate-600 dark:text-slate-400 text-sm">{(getValue() as string) ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'bus_number',
      header: ({ column }) => <SortHeader column={column} label="Bus" />,
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        return <span className="text-slate-500 dark:text-slate-400 text-sm">{v ? `Bus ${v}` : '—'}</span>
      },
      enableGlobalFilter: false,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <SortHeader column={column} label="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      enableGlobalFilter: false,
    },
    {
      accessorKey: 'last_changed_at',
      header: ({ column }) => <SortHeader column={column} label="Changed" />,
      cell: ({ getValue }) => (
        <span className="text-slate-400 dark:text-slate-500 text-xs">{formatTime(getValue() as string | null)}</span>
      ),
      enableGlobalFilter: false,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original
        return (
          <button
            onClick={() => toggle(p.id)}
            disabled={toggling === p.id}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50 whitespace-nowrap ${
              p.status === 'on_bus'
                ? 'bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300'
                : 'bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {toggling === p.id ? '…' : p.status === 'on_bus' ? 'Mark Off' : 'Mark Back'}
          </button>
        )
      },
      enableSorting: false,
      enableGlobalFilter: false,
    },
  ], [toggling]) // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({
    data: displayData,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: (row: Row<Profile>, _colId: string, filterValue: string) => {
      const q = filterValue.toLowerCase()
      const p = row.original
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.student_id ?? '').toLowerCase().includes(q) ||
        (p.group_label ?? '').toLowerCase().includes(q)
      )
    },
    getCoreRowModel:       getCoreRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const filteredRows = table.getFilteredRowModel().rows.map(r => r.original)
  const pageRows     = table.getRowModel().rows

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (busFilter !== 'all' ? 1 : 0) +
    (groupFilter !== 'all' ? 1 : 0)

  const filterBtnClass = (active: boolean) =>
    `text-xs px-2.5 py-1.5 rounded-lg font-medium transition border ${
      active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
    }`

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div id="onb-filters" className="space-y-2">
        {/* Primary row: search + filters toggle + export (stays compact on mobile) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search name, NIM, group…"
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setFiltersOpen(o => !o)}
            title="Filters"
            className={`relative flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition flex-shrink-0 ${
              filtersOpen || activeFilterCount > 0
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 bg-white dark:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-blue-600 text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Export — icon-only on mobile, labelled on larger screens */}
          <div id="onb-export" className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => exportCSV(filteredRows)}
              title="Export CSV"
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition bg-white dark:bg-slate-800"
            >
              <Download size={15} />
              <span className="hidden md:inline">CSV</span>
            </button>
            <button
              onClick={() => exportExcel(filteredRows)}
              title="Export Excel"
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition bg-white dark:bg-slate-800"
            >
              <FileSpreadsheet size={15} />
              <span className="hidden md:inline">Excel</span>
            </button>
          </div>
        </div>

        {/* Secondary row: collapsible filters */}
        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2">
            {/* Status filter */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
              {(['all', 'on_bus', 'off_bus'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={filterBtnClass(statusFilter === s)}>
                  {s === 'all' ? 'All' : s === 'on_bus' ? 'On Bus' : 'Off Bus'}
                </button>
              ))}
            </div>

            {/* Bus filter */}
            <select
              value={busFilter}
              onChange={e => setBusFilter(e.target.value)}
              className="app-select text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Buses</option>
              <option value="1">Bus 1</option>
              <option value="2">Bus 2</option>
            </select>

            {/* Group filter */}
            {groups.length > 0 && (
              <select
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className="app-select text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Groups</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            {activeFilterCount > 0 && (
              <button
                onClick={() => { setStatusFilter('all'); setBusFilter('all'); setGroupFilter('all') }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1.5 transition"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Count ── */}
      <p className="text-xs text-slate-500">
        {filteredRows.length === members.length
          ? `${members.length} members`
          : `${filteredRows.length} of ${members.length} members`}
      </p>

      {/* ── Table ── */}
      <div id="onb-table" className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              {table.getFlatHeaders().map(header => (
                <th key={header.id} className={`text-left px-4 py-3 ${
                  header.id === 'student_id' ? 'hidden sm:table-cell' :
                  header.id === 'group_label' ? 'hidden md:table-cell' :
                  header.id === 'bus_number' ? 'hidden md:table-cell' :
                  header.id === 'last_changed_at' ? 'hidden lg:table-cell' : ''
                }`}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-slate-400 dark:text-slate-500">
                  No members match your filters.
                </td>
              </tr>
            )}
            {pageRows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={`px-4 py-3 ${
                    cell.column.id === 'student_id' ? 'hidden sm:table-cell' :
                    cell.column.id === 'group_label' ? 'hidden md:table-cell' :
                    cell.column.id === 'bus_number' ? 'hidden md:table-cell' :
                    cell.column.id === 'last_changed_at' ? 'hidden lg:table-cell' : ''
                  }`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next <ChevronRight size={13} />
          </button>
        </div>

        <select
          value={pagination.pageSize}
          onChange={e => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), pageIndex: 0 }))}
          className="app-select text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[10, 20, 50, 100].map(n => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      </div>
    </div>
  )
}
