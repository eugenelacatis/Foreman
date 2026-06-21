import { useState } from "react";
import { Filter, Search } from "lucide-react";
import ClientDetailView from "./ClientDetailView";

/* ============================================================
   Types + mock data
   ============================================================ */
type Status = "awaiting" | "paid" | "sent" | "draft";

interface Invoice {
  id: string;
  job: string;
  amount: number;
}

interface Client {
  id: string;
  name: string;
  initials: string;
  sub: string;
  status: Status;
  invoices: Invoice[];
  more: number;
  total: number;
}

const CLIENTS: Client[] = [
  {
    id: "c1",
    name: "Maplewood HVAC",
    initials: "MH",
    sub: "Dana Reyes · Net 30",
    status: "awaiting",
    invoices: [
      { id: "INV-1041", job: "AC repair · Cedar Court", amount: 425 },
      { id: "INV-1037", job: "Rooftop unit service", amount: 612 },
      { id: "INV-1030", job: "Thermostat replacement", amount: 180 },
    ],
    more: 1,
    total: 1217,
  },
  {
    id: "c2",
    name: "Cedar Court Apartments",
    initials: "CC",
    sub: "Property mgmt · 12 units",
    status: "paid",
    invoices: [
      { id: "INV-1039", job: "Furnace inspection", amount: 240 },
      { id: "INV-1028", job: "AC tune-up", amount: 165 },
    ],
    more: 0,
    total: 405,
  },
  {
    id: "c3",
    name: "Riverside Property Mgmt",
    initials: "RP",
    sub: "Net 15",
    status: "sent",
    invoices: [
      { id: "INV-1042", job: "Boiler repair", amount: 890 },
      { id: "INV-1035", job: "Coil cleaning", amount: 210 },
    ],
    more: 2,
    total: 1100,
  },
  {
    id: "c4",
    name: "Oak Street Realty",
    initials: "OS",
    sub: "Net 30",
    status: "draft",
    invoices: [
      { id: "INV-1043", job: "Thermostat swap", amount: 145 },
    ],
    more: 0,
    total: 145,
  },
  {
    id: "c5",
    name: "Summit Facilities Group",
    initials: "SF",
    sub: "Dispatch · Net 30",
    status: "awaiting",
    invoices: [
      { id: "INV-1040", job: "Compressor replace", amount: 1240 },
      { id: "INV-1031", job: "Duct sealing", amount: 560 },
    ],
    more: 3,
    total: 1800,
  },
  {
    id: "c6",
    name: "Brookline Management",
    initials: "BM",
    sub: "Net 30",
    status: "paid",
    invoices: [
      { id: "INV-1036", job: "Heat pump service", amount: 430 },
      { id: "INV-1029", job: "Filter program", amount: 95 },
    ],
    more: 1,
    total: 525,
  },
];

/* ============================================================
   Helpers
   ============================================================ */
const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const STATUS_STYLES: Record<Status, { pill: string; label: string }> = {
  awaiting: { pill: "bg-[#eef3ff] text-[#2563eb]", label: "Awaiting you" },
  paid:     { pill: "bg-[#ecfdf3] text-[#15803d]", label: "Paid" },
  sent:     { pill: "bg-[#f1f2f4] text-[#5b6573]", label: "Sent" },
  draft:    { pill: "bg-[#f1f2f4] text-[#5b6573]", label: "Draft" },
};

/* ============================================================
   ClientCard
   ============================================================ */
function ClientCard({ client, onViewClick }: { client: Client; onViewClick: () => void }) {
  const { pill, label } = STATUS_STYLES[client.status];

  return (
    <div className="flex h-full flex-col rounded-[10px] border border-[var(--color-hairline)] bg-white">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-tint)] text-[12px] font-semibold text-[var(--color-accent)]">
            {client.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-[var(--color-ink)]">
              {client.name}
            </p>
            <p className="truncate text-[12px] text-[var(--color-ink-3)]">{client.sub}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-[6px] px-2 py-[3px] text-[11px] font-semibold ${pill}`}>
          {label}
        </span>
      </div>

      {/* Invoice rows */}
      <div className="flex flex-col border-t border-[var(--color-hairline)] px-4 py-2.5 gap-2">
        {client.invoices.map((inv) => (
          <div key={inv.id} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-[12.5px] text-[var(--color-ink-2)]">
              {inv.job}
              <span className="num ml-1.5 text-[var(--color-ink-3)]">· {inv.id}</span>
            </span>
            <span className="num shrink-0 text-[12.5px] text-[var(--color-ink)]">
              {fmtMoney(inv.amount)}
            </span>
          </div>
        ))}
        {client.more > 0 && (
          <p className="text-[12px] text-[var(--color-ink-3)]">+{client.more} more</p>
        )}
      </div>

      {/* Total + View */}
      <div className="mt-auto flex items-center justify-between border-t border-[var(--color-hairline)] px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-medium text-[var(--color-ink-2)]">Total</span>
          <span className="num text-[13px] font-semibold text-[var(--color-accent)]">
            {fmtMoney(client.total)}
          </span>
        </div>
        <button
          type="button"
          onClick={onViewClick}
          className="rounded-[8px] border border-[var(--color-hairline)] px-3 py-1 text-[12.5px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[#fafbfd]"
        >
          View
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ClientsView — exported
   ============================================================ */
interface ClientsViewProps {
  onOpenInvoice?: (invoiceId: string) => void;
}

export default function ClientsView({ onOpenInvoice }: ClientsViewProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  if (selectedClientId !== null) {
    const client = CLIENTS.find((c) => c.id === selectedClientId);
    return (
      <ClientDetailView
        clientId={selectedClientId}
        clientName={client?.name ?? "Client"}
        onBack={() => setSelectedClientId(null)}
        onOpenInvoice={onOpenInvoice}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-[var(--color-ink)]">
          Clients
        </h1>
        <span className="num text-[13px] text-[var(--color-ink-3)]">{fmtDate()}</span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Segmented tabs */}
        <div className="flex items-center rounded-[8px] border border-[var(--color-hairline)] bg-[#fafbfd] p-0.5">
          {(["All", "Active", "Paid"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={
                "rounded-[6px] px-3 h-7 text-[12.5px] font-medium transition-colors " +
                (tab === "All"
                  ? "bg-white text-[var(--color-ink)] border border-[var(--color-hairline)]"
                  : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]")
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-[var(--color-hairline)] bg-white px-3 h-8">
          <Search size={13} strokeWidth={1.75} className="shrink-0 text-[var(--color-ink-3)]" />
          <span className="truncate text-[13px] text-[var(--color-ink-3)]">
            Search a client or invoice
          </span>
        </div>

        {/* Filter */}
        <button
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-[var(--color-hairline)] bg-white text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ink)]"
        >
          <Filter size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Card grid */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        {CLIENTS.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onViewClick={() => setSelectedClientId(client.id)}
          />
        ))}
      </div>
    </div>
  );
}
