import { ArrowLeft, ChevronRight, Plus } from "lucide-react";

/* ============================================================
   Types
   ============================================================ */
type InvoiceStatus = "awaiting" | "paid" | "sent" | "draft";

interface ClientInfo {
  name: string;
  initials: string;
  contact: string;
  email: string;
  terms: string;
  status: InvoiceStatus;
}

interface ClientSummary {
  count: number;
  billed: number;
  outstanding: number;
}

interface ClientInvoice {
  id: string;
  job: string;
  date: string;
  status: InvoiceStatus;
  amount: number;
}

interface ClientDetail {
  client: ClientInfo;
  summary: ClientSummary;
  invoices: ClientInvoice[];
}

/* ============================================================
   Seam: getClientInvoices
   Swap for real per-client invoice fetch when backend is ready.
   ============================================================ */
const MOCK_CLIENT_DATA: Record<string, ClientDetail> = {
  c1: {
    client: {
      name: "Maplewood HVAC",
      initials: "MH",
      contact: "Dana Reyes",
      email: "dispatch@maplewoodhvac.com",
      terms: "Net 30",
      status: "awaiting",
    },
    summary: { count: 4, billed: 1477, outstanding: 425 },
    invoices: [
      {
        id: "INV-1041",
        job: "AC repair · Cedar Court Unit 2B",
        date: "Jun 19, 2026",
        status: "awaiting",
        amount: 425,
      },
      {
        id: "INV-1037",
        job: "Rooftop unit service",
        date: "May 28, 2026",
        status: "paid",
        amount: 612,
      },
      {
        id: "INV-1030",
        job: "Thermostat replacement",
        date: "May 12, 2026",
        status: "paid",
        amount: 180,
      },
      {
        id: "INV-1019",
        job: "Spring maintenance",
        date: "Apr 30, 2026",
        status: "paid",
        amount: 260,
      },
    ],
  },
};

function getClientInvoices(clientId: string): ClientDetail | null {
  return MOCK_CLIENT_DATA[clientId] ?? null;
}

/* ============================================================
   Helpers
   ============================================================ */
const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLES: Record<InvoiceStatus, { pill: string; label: string }> = {
  awaiting: { pill: "bg-[#eef3ff] text-[#2563eb]", label: "Awaiting you" },
  paid:     { pill: "bg-[#ecfdf3] text-[#15803d]", label: "Paid" },
  sent:     { pill: "bg-[#f1f2f4] text-[#5b6573]", label: "Sent" },
  draft:    { pill: "bg-[#f1f2f4] text-[#5b6573]", label: "Draft" },
};

/* ============================================================
   ClientDetailView — exported
   ============================================================ */
export interface ClientDetailViewProps {
  clientId: string;
  clientName: string;
  onBack: () => void;
  onOpenInvoice?: (invoiceId: string) => void;
}

export default function ClientDetailView({
  clientId,
  clientName,
  onBack,
  onOpenInvoice,
}: ClientDetailViewProps) {
  const detail = getClientInvoices(clientId);
  const displayName = detail?.client.name ?? clientName;

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--color-ink-3)] transition-colors hover:bg-[#f7f8fa] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft size={15} strokeWidth={2} />
          </button>
          <nav className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
            >
              Clients
            </button>
            <span className="text-[var(--color-ink-3)]">/</span>
            <span className="truncate font-medium text-[var(--color-ink)]">{displayName}</span>
          </nav>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-[var(--color-hairline)] px-3 h-8 text-[12.5px] text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
        >
          <Plus size={13} strokeWidth={1.75} />
          New invoice
        </button>
      </div>

      {detail == null ? (
        <div className="rounded-[12px] border border-[var(--color-hairline)] bg-white px-6 py-10 text-center text-[13px] text-[var(--color-ink-3)]">
          No invoice data for this client yet.
        </div>
      ) : (
        <>
          {/* Client summary card */}
          <div className="overflow-hidden rounded-[12px] border border-[var(--color-hairline)] bg-white">
            {/* Avatar + name + status */}
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-accent-tint)] text-[14px] font-semibold text-[var(--color-accent)]">
                  {detail.client.initials}
                </span>
                <div className="min-w-0">
                  <p className="font-display truncate text-[17px] font-semibold tracking-tight text-[var(--color-ink)]">
                    {detail.client.name}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-2)]">
                    {detail.client.contact} ·{" "}
                    <span className="num">{detail.client.email}</span>
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-[6px] px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLES[detail.client.status].pill}`}
              >
                {STATUS_STYLES[detail.client.status].label}
              </span>
            </div>

            {/* Stats row */}
            <div className="flex items-start divide-x divide-[var(--color-hairline)] border-t border-[var(--color-hairline)]">
              <div className="px-6 py-4">
                <p className="num text-[15px] font-semibold text-[var(--color-ink)]">
                  {detail.summary.count}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">Invoices</p>
              </div>
              <div className="px-6 py-4">
                <p className="num text-[15px] font-semibold text-[var(--color-ink)]">
                  {fmtMoney(detail.summary.billed)}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">Billed</p>
              </div>
              <div className="px-6 py-4">
                <p className="num text-[15px] font-semibold text-[var(--color-accent)]">
                  {fmtMoney(detail.summary.outstanding)}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">Outstanding</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-[15px] font-semibold text-[var(--color-ink)]">
                  {detail.client.terms}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">Terms</p>
              </div>
            </div>
          </div>

          {/* Invoice list */}
          <div>
            <h2 className="mb-3 font-display text-[15px] font-semibold text-[var(--color-ink)]">
              Invoices{" "}
              <span className="num font-normal text-[var(--color-ink-3)]">
                ({detail.invoices.length})
              </span>
            </h2>
            <div className="overflow-hidden rounded-[12px] border border-[var(--color-hairline)] bg-white divide-y divide-[var(--color-hairline)]">
              {detail.invoices.map((inv) => {
                const { pill, label } = STATUS_STYLES[inv.status];
                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => onOpenInvoice?.(inv.id)}
                    className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#fafbfd]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                        {inv.job}
                      </p>
                      <p className="num mt-0.5 text-[12px] text-[var(--color-ink-3)]">
                        {inv.id} · {inv.date}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-[6px] px-2 py-[3px] text-[11px] font-semibold ${pill}`}
                    >
                      {label}
                    </span>
                    <span className="num w-[72px] shrink-0 text-right text-[13.5px] font-medium text-[var(--color-ink)]">
                      {fmtMoney(inv.amount)}
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={1.75}
                      className="shrink-0 text-[var(--color-ink-3)] transition-colors group-hover:text-[var(--color-ink)]"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
