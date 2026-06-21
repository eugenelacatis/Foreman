import { useState } from "react";
import {
  ArrowLeft,
  CircleCheck,
  Flag,
  History,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import ArmorIQGate from "./invoice-flow/ArmorIQGate";

/* ============================================================
   Types
   ============================================================ */
type ApprovalStatus = "ready" | "review" | "sent";

interface ApprovalLine {
  desc: string;
  amount: number;
}

interface Approval {
  id: string;
  client: string;
  contact: string;
  addr: string;
  job: string;
  po: string;
  issued: string;
  due: string;
  terms: string;
  total: number;
  status: ApprovalStatus;
  flag?: string;
  lines: ApprovalLine[];
}

/* ============================================================
   Seam: getApprovals
   Swap this for a real fetch from the backend when the
   "invoices awaiting approval" endpoint is ready.
   ============================================================ */
const MOCK_APPROVALS: Approval[] = [
  {
    id: "INV-1041",
    client: "Maplewood HVAC",
    contact: "Dana Reyes",
    addr: "Cedar Court Unit 2B",
    job: "AC repair",
    po: "MW-1041",
    issued: "Jun 21, 2026",
    due: "Jul 21, 2026",
    terms: "Net 30",
    total: 425,
    status: "ready",
    lines: [
      { desc: "Compressor capacitor — replace", amount: 92 },
      { desc: "Contactor — replace", amount: 48 },
      { desc: "Labor · 3.0 hrs @ $95.00", amount: 285 },
    ],
  },
  {
    id: "INV-1042",
    client: "Delgado Electric",
    contact: "Marco Delgado",
    addr: "480 Commerce Blvd",
    job: "Panel upgrade",
    po: "DE-220",
    issued: "Jun 21, 2026",
    due: "Jul 21, 2026",
    terms: "Net 30",
    total: 980,
    lines: [
      { desc: "200A panel", amount: 540 },
      { desc: "Breakers (6)", amount: 180 },
      { desc: "Labor · 2.5 hrs @ $104.00", amount: 260 },
    ],
    status: "ready",
  },
  {
    id: "INV-1044",
    client: "Summit Facilities",
    contact: "Priya Nair",
    addr: "12 Industrial Pkwy",
    job: "Compressor replace",
    po: "SF-771",
    issued: "Jun 21, 2026",
    due: "Jul 21, 2026",
    terms: "Net 30",
    total: 1240,
    status: "review",
    flag: "Confirm labor rate — $120/hr is above your standard $95",
    lines: [
      { desc: "Compressor unit", amount: 880 },
      { desc: "Refrigerant", amount: 120 },
      { desc: "Labor · 2.0 hrs @ $120.00", amount: 240 },
    ],
  },
];

function getApprovals(): Approval[] {
  return MOCK_APPROVALS;
}

/* ============================================================
   Helpers
   ============================================================ */
const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLES: Record<ApprovalStatus, { pill: string; label: string }> = {
  ready:  { pill: "bg-[#f1f2f4] text-[#5b6573]",   label: "Ready" },
  review: { pill: "bg-[#eef3ff] text-[#2563eb]",   label: "Needs review" },
  sent:   { pill: "bg-[#ecfdf3] text-[#15803d]",   label: "Sent" },
};

/* ============================================================
   Left panel — list card
   ============================================================ */
function ApprovalCard({
  approval,
  selected,
  sent,
  onClick,
}: {
  approval: Approval;
  selected: boolean;
  sent: boolean;
  onClick: () => void;
}) {
  const status: ApprovalStatus = sent ? "sent" : approval.status;
  const { pill, label } = STATUS_STYLES[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full rounded-[10px] border p-3.5 text-left transition-colors " +
        (selected
          ? "border-[var(--color-accent)] bg-[#f5f8ff]"
          : "border-[var(--color-hairline)] bg-white hover:bg-[#fafbfd]")
      }
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="num text-[12.5px] font-semibold text-[var(--color-ink)]">
          {approval.id}
        </span>
        <span className={`shrink-0 rounded-[6px] px-2 py-[2px] text-[11px] font-semibold ${pill}`}>
          {label}
        </span>
      </div>
      <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">{approval.client}</p>
      <p className="truncate text-[12px] text-[var(--color-ink-3)]">{approval.job}</p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="num text-[12.5px] font-semibold text-[var(--color-accent)]">
          {fmtMoney(approval.total)}
        </span>
        <span className="num text-[11.5px] text-[var(--color-ink-3)]">{approval.issued}</span>
      </div>
      {sent && (
        <div className="mt-2 flex items-center gap-1 text-[11.5px] text-[#15803d]">
          <CircleCheck size={11} strokeWidth={2.5} />
          Sent
        </div>
      )}
    </button>
  );
}

/* ============================================================
   Right panel — invoice document
   ============================================================ */
function InvoiceDocument({ approval }: { approval: Approval }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--color-hairline)] bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-6 px-8 pt-8 pb-6">
        <div className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
            <Wrench size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-display text-[16px] font-semibold tracking-tight text-[var(--color-ink)]">
              R&amp;K HVAC Services
            </p>
            <p className="text-[12px] text-[var(--color-ink-2)]">ray@rkhvacservices.com</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-[24px] font-semibold tracking-tight text-[var(--color-ink)]">
            Invoice
          </p>
          <p className="num mt-0.5 text-[12.5px] uppercase tracking-wide text-[var(--color-ink-3)]">
            {approval.id}
          </p>
          <div className="mt-2.5 space-y-0.5 text-[12px]">
            <p className="text-[var(--color-ink-2)]">
              Issued <span className="num text-[var(--color-ink)]">{approval.issued}</span>
            </p>
            <p className="text-[var(--color-ink-2)]">
              Due <span className="num font-medium text-[var(--color-ink)]">{approval.due}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-8 h-px bg-[var(--color-hairline)]" />

      {/* Bill-to + details */}
      <div className="grid grid-cols-2 gap-6 px-8 py-6 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Billed to
          </p>
          <p className="text-[13px] font-medium text-[var(--color-ink)]">{approval.contact}</p>
          <p className="text-[13px] text-[var(--color-ink-2)]">{approval.client}</p>
          <p className="text-[12.5px] text-[var(--color-ink-3)]">{approval.addr}</p>
        </div>
        <div>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Details
          </p>
          <div className="space-y-1 text-[12.5px]">
            <p className="text-[var(--color-ink-2)]">
              PO <span className="num text-[var(--color-ink)]">{approval.po}</span>
            </p>
            <p className="text-[var(--color-ink-2)]">
              Terms <span className="text-[var(--color-ink)]">{approval.terms}</span>
            </p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Job
          </p>
          <p className="text-[13px] text-[var(--color-ink)]">{approval.job}</p>
        </div>
      </div>

      <div className="mx-8 h-px bg-[var(--color-hairline)]" />

      {/* Line items */}
      <div className="px-8 py-5">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-hairline)]">
              <th className="pb-2 text-left text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
                Description
              </th>
              <th className="pb-2 text-right text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {approval.lines.map((line, i) => (
              <tr key={i}>
                <td className="py-2.5 text-[13px] text-[var(--color-ink-2)]">{line.desc}</td>
                <td className="num py-2.5 text-right text-[13px] text-[var(--color-ink)]">
                  {fmtMoney(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--color-hairline)] pt-4">
          <span className="text-[13px] font-semibold text-[var(--color-ink)]">Total</span>
          <span className="num text-[18px] font-semibold text-[var(--color-accent)]">
            {fmtMoney(approval.total)}
          </span>
        </div>
      </div>

      {/* Flag callout */}
      {approval.flag && (
        <div className="mx-8 mb-6 flex items-start gap-2.5 rounded-[8px] border border-[var(--color-hairline)] bg-[var(--color-accent-tint)] px-3.5 py-3">
          <Flag size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
          <p className="text-[12.5px] leading-snug text-[var(--color-accent)]">{approval.flag}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ApprovalsView — exported
   ============================================================ */
export interface ApprovalsViewProps {
  onBack?: () => void;
  onSent?: () => void;
}

export default function ApprovalsView({ onBack, onSent }: ApprovalsViewProps) {
  const [approvals] = useState<Approval[]>(getApprovals);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string>(approvals[0]?.id ?? "");

  const selected = approvals.find((a) => a.id === selectedId) ?? approvals[0];
  const pendingCount = approvals.filter((a) => !sentIds.has(a.id)).length;

  const handleSent = () => {
    const next = new Set(sentIds);
    next.add(selectedId);
    setSentIds(next);
    onSent?.();

    // Auto-advance to next unsent
    const pending = approvals.filter((a) => !next.has(a.id));
    if (pending.length > 0) setSelectedId(pending[0].id);
  };

  const isSent = sentIds.has(selectedId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--color-ink-3)] transition-colors hover:bg-[#f7f8fa] hover:text-[var(--color-ink)]"
            >
              <ArrowLeft size={15} strokeWidth={2} />
            </button>
          )}
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-[var(--color-ink)]">
            Approvals
          </h1>
          {pendingCount > 0 && (
            <span className="num inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[11px] font-semibold text-white">
              {pendingCount}
            </span>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--color-hairline)] px-3 h-8 text-[12.5px] text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
        >
          <History size={13} strokeWidth={1.75} />
          Activity log
        </button>
      </div>

      {/* Two-column split */}
      <div className="flex items-start gap-5">
        {/* Left — pending list */}
        <div className="sticky top-8 flex w-[280px] shrink-0 flex-col gap-2">
          {approvals.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              selected={a.id === selectedId}
              sent={sentIds.has(a.id)}
              onClick={() => setSelectedId(a.id)}
            />
          ))}
        </div>

        {/* Right — detail */}
        {selected && (
          <div className="min-w-0 flex-1">
            <InvoiceDocument approval={selected} />

            {/* Footer */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-3)]">
                <ShieldCheck size={13} strokeWidth={1.75} />
                Goes through ArmorIQ — you approve the send.
              </span>

              {isSent ? (
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#15803d]">
                  <CircleCheck size={14} strokeWidth={2.5} />
                  Sent
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-9 rounded-[8px] border border-[var(--color-hairline)] px-3.5 text-[13px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[#fafbfd]"
                  >
                    Edit
                  </button>
                  <ArmorIQGate
                    action={{ type: "send-invoice", invoiceId: selected.id, amount: selected.total }}
                    onAllow={handleSent}
                  >
                    {(check) => (
                      <button
                        type="button"
                        onClick={check}
                        className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4fd1]"
                      >
                        Approve &amp; send
                      </button>
                    )}
                  </ArmorIQGate>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
