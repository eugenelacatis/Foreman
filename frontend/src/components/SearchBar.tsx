import { useMemo, useRef, useState, useEffect } from "react";
import { Search, Users, FileText, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ResultType = "client" | "invoice" | "workOrder";

export interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
}

interface Result extends SearchResult {
  sub: string;
}

const TYPE_META: Record<ResultType, { icon: LucideIcon; label: string }> = {
  client: { icon: Users, label: "Client" },
  invoice: { icon: FileText, label: "Invoice" },
  workOrder: { icon: Wrench, label: "Work order" },
};

const ALL_RESULTS: Result[] = [
  { id: 'c1', type: 'client', title: 'Maplewood HVAC', sub: '3 invoices · 2 active' },
  { id: 'c2', type: 'client', title: 'Riverside Property', sub: '5 invoices · 1 active' },
  { id: 'c3', type: 'client', title: 'Delgado Electric', sub: '2 invoices · 1 active' },
  { id: 'c4', type: 'client', title: 'Oak Street Plumbing', sub: '8 invoices · 0 active' },
  { id: 'wo-1041', type: 'workOrder', title: 'AC unit replacement — 2nd floor', sub: 'Maplewood HVAC · Jun 19' },
  { id: 'wo-1040', type: 'workOrder', title: 'Quarterly maintenance walkthrough', sub: 'Riverside Property · Jun 19' },
  { id: 'wo-1039', type: 'workOrder', title: 'Panel upgrade — back office', sub: 'Delgado Electric · Jun 19' },
  { id: 'wo-1037', type: 'workOrder', title: 'Water heater install', sub: 'Oak Street Plumbing · Jun 18' },
  { id: 'wo-1035', type: 'workOrder', title: 'Rooftop unit diagnostic', sub: 'Maplewood HVAC · Jun 17' },
  { id: 'inv-2210', type: 'invoice', title: 'Invoice #2210 — Maplewood HVAC', sub: '$1,240.00 · awaiting approval' },
  { id: 'inv-2208', type: 'invoice', title: 'Invoice #2208 — Oak Street Plumbing', sub: '$610.00 · sent' },
]

interface SearchBarProps {
  placeholder?: string;
  onSelect?: (result: SearchResult) => void;
}

export default function SearchBar({
  placeholder = "Search clients, work orders, invoices…",
  onSelect,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ALL_RESULTS.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.sub.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    ).slice(0, 6)
  }, [query])

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const showDropdown = open && query.trim().length > 0

  return (
    <div className="relative" ref={wrapRef}>
      <label className="relative block">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[var(--color-ink-3)]">
          <Search size={15} strokeWidth={1.75} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-10 w-full rounded-[10px] border border-[var(--color-hairline)] bg-white pl-10 pr-3.5 text-[14px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] outline-none transition-colors focus:border-[var(--color-accent-50)] focus:ring-2 focus:ring-[var(--color-accent-15)]"
        />
      </label>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white">
          {results.length > 0 ? (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {results.map((r) => {
                const meta = TYPE_META[r.type]
                const Icon = meta.icon
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuery(r.title);
                        setOpen(false);
                        onSelect?.({ id: r.id, type: r.type, title: r.title });
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#fafbfd]"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#f7f8fa] text-[var(--color-ink-2)]">
                        <Icon size={14} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-[var(--color-ink)]">
                          {r.title}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--color-ink-3)]">
                          {r.sub}
                        </span>
                      </span>
                      <span className="num text-[11px] uppercase tracking-wide text-[var(--color-ink-3)]">
                        {meta.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-4 py-5 text-center text-[13px] text-[var(--color-ink-3)]">
              No matches for “{query}”.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
