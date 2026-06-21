import { useMemo, useState } from "react";
import { ChevronDown, Check, Mic, ArrowUpRight } from "lucide-react";
import SectionHeading from "./SectionHeading";

type StatusValue = "need_invoice" | "emailed" | "waiting" | "done";
type Tone = "accent" | "neutral" | "sent";
type FilterValue = "all" | "needs_you" | "waiting" | "done";

interface StatusOption {
  value: StatusValue;
  label: string;
  tone: Tone;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: "need_invoice", label: "Need invoice", tone: "accent" },
  { value: "emailed", label: "Emailed", tone: "neutral" },
  { value: "waiting", label: "Waiting for response", tone: "neutral" },
  { value: "done", label: "Done", tone: "sent" },
];
const STATUS_TONE: Record<StatusValue, Tone> = STATUS_OPTIONS.reduce(
  (m, o) => ({ ...m, [o.value]: o.tone }),
  {} as Record<StatusValue, Tone>,
);
const STATUS_LABEL: Record<StatusValue, string> = STATUS_OPTIONS.reduce(
  (m, o) => ({ ...m, [o.value]: o.label }),
  {} as Record<StatusValue, string>,
);

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_you", label: "Needs you" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

const FILTER_MATCH: Record<FilterValue, Set<StatusValue> | null> = {
  all: null,
  needs_you: new Set<StatusValue>(["need_invoice"]),
  waiting: new Set<StatusValue>(["waiting", "emailed"]),
  done: new Set<StatusValue>(["done"]),
};

export interface WorkOrderRow {
  id: string;
  title: string;
  created: string;
  client: string;
  amount: number;
  status: StatusValue;
  sendEmail: boolean;
  aging?: string;
  voiceNote?: boolean;
}

const initialRows: WorkOrderRow[] = [
  {
    id: 'wo-1041',
    title: 'AC unit replacement — 2nd floor',
    created: 'Jun 19',
    client: 'Maplewood HVAC',
    amount: 1240.0,
    status: 'need_invoice',
    sendEmail: true,
  },
  {
    id: 'wo-1040',
    title: 'Quarterly maintenance walkthrough',
    created: 'Jun 19',
    client: 'Riverside Property',
    amount: 320.0,
    status: 'waiting',
    aging: '2d',
    sendEmail: false,
  },
  {
    id: 'wo-1039',
    title: 'Panel upgrade — back office',
    created: 'Jun 19',
    client: 'Delgado Electric',
    amount: 890.0,
    status: 'need_invoice',
    sendEmail: true,
    voiceNote: true,
  },
  {
    id: 'wo-1037',
    title: 'Water heater install',
    created: 'Jun 18',
    client: 'Oak Street Plumbing',
    amount: 610.0,
    status: 'done',
    sendEmail: false,
  },
  {
    id: 'wo-1035',
    title: 'Rooftop unit diagnostic',
    created: 'Jun 17',
    client: 'Maplewood HVAC',
    amount: 185.0,
    status: 'emailed',
    aging: '3d',
    sendEmail: false,
  },
]

const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusSelect({
  value,
  onChange,
}: {
  value: StatusValue;
  onChange: (v: StatusValue) => void;
}) {
  const tone = STATUS_TONE[value];
  const tones: Record<Tone, string> = {
    accent: "bg-[var(--color-accent-tint)] text-[var(--color-accent)]",
    neutral: "bg-[var(--color-neutral-tint)] text-[var(--color-neutral-ink)]",
    sent: "bg-[var(--color-sent-tint)] text-[var(--color-sent-ink)]",
  };

  return (
    <div className={`relative inline-flex items-center rounded-[6px] ${tones[tone]}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StatusValue)}
        className="appearance-none bg-transparent pl-2 pr-6 py-1 text-[12.5px] font-medium leading-none outline-none cursor-pointer rounded-[6px]"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="text-[var(--color-ink)] bg-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} strokeWidth={2} className="pointer-events-none absolute right-1.5" />
    </div>
  )
}

function EmailCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={checked ? 'Email queued' : 'Queue email'}
      className={
        'grid h-5 w-5 place-items-center rounded-[6px] border transition-colors ' +
        (checked
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
          : 'border-[var(--color-hairline)] bg-white text-transparent hover:border-[var(--color-ink-3)]')
      }
    >
      <Check size={13} strokeWidth={3} />
    </button>
  )
}

function FilterSegment({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-[8px] border border-[var(--color-hairline)] bg-white p-0.5">
      {FILTERS.map((f) => {
        const active = value === f.value
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange(f.value)}
            className={
              'rounded-[6px] px-2.5 py-1 text-[12.5px] font-medium transition-colors ' +
              (active
                ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)]'
                : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]')
            }
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

interface WorkOrdersProps {
  onViewOrder?: (row: WorkOrderRow) => void;
}

export default function WorkOrders({ onViewOrder }: WorkOrdersProps) {
  const [rows, setRows] = useState<WorkOrderRow[]>(initialRows);
  const [filter, setFilter] = useState<FilterValue>("all");

  const update = (id: string, patch: Partial<WorkOrderRow>) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const visible = useMemo(() => {
    const match = FILTER_MATCH[filter]
    if (!match) return rows
    return rows.filter((r) => match.has(r.status))
  }, [rows, filter])

  const total = useMemo(() => visible.reduce((sum, r) => sum + (r.amount || 0), 0), [visible])

  return (
    <section>
      <SectionHeading
        title="All work orders & invoices"
        right={<FilterSegment value={filter} onChange={setFilter} />}
      />

      <div className="overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[#fafbfd]">
                <th className="px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Work order
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Created
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Client
                </th>
                <th className="px-4 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Amount
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Status
                </th>
                <th className="px-4 py-2.5 text-center text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Send email
                </th>
                <th className="px-4 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr
                  key={row.id}
                  className={
                    'transition-colors hover:bg-[#fafbfd] ' +
                    (i > 0 ? 'border-t border-[var(--color-hairline)]' : '')
                  }
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
                        {row.title}
                      </span>
                      {row.voiceNote ? (
                        <button
                          type="button"
                          aria-label="Play voice note"
                          title="Play voice note"
                          className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-accent-tint)] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
                        >
                          <Mic size={11} strokeWidth={2.25} />
                        </button>
                      ) : null}
                    </div>
                    <div className="num text-[12px] text-[var(--color-ink-3)]">{row.id}</div>
                  </td>
                  <td className="num px-4 py-3 align-middle text-[13px] text-[var(--color-ink-2)] whitespace-nowrap">
                    {row.created}
                  </td>
                  <td className="px-4 py-3 align-middle text-[13.5px] text-[var(--color-ink)] whitespace-nowrap">
                    {row.client}
                  </td>
                  <td className="num px-4 py-3 align-middle text-right text-[13.5px] text-[var(--color-ink)] whitespace-nowrap">
                    {fmtMoney(row.amount)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <StatusSelect
                        value={row.status}
                        onChange={(v) => update(row.id, { status: v })}
                      />
                      {row.aging ? (
                        <span className="num text-[11.5px] text-[var(--color-ink-3)]">
                          {row.aging}
                        </span>
                      ) : null}
                    </div>
                    <span className="sr-only">{STATUS_LABEL[row.status]}</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex justify-center">
                      <EmailCheckbox
                        checked={row.sendEmail}
                        onChange={(v) => update(row.id, { sendEmail: v })}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onViewOrder?.(row)}
                      className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--color-hairline)] px-2.5 h-7 text-[12.5px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[#fafbfd] hover:border-[var(--color-ink-3)]"
                    >
                      View order
                      <ArrowUpRight size={12} strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              ))}

              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-[13px] text-[var(--color-ink-3)]"
                  >
                    Nothing here for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>

            {visible.length > 0 ? (
              <tfoot>
                <tr className="border-t border-[var(--color-hairline)] bg-[#fafbfd]">
                  <td
                    colSpan={3}
                    className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]"
                  >
                    Total
                  </td>
                  <td className="num px-4 py-2.5 text-right text-[13.5px] font-semibold text-[var(--color-ink)] whitespace-nowrap">
                    {fmtMoney(total)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </section>
  )
}
