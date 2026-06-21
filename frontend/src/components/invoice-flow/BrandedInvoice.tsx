import { Wrench } from "lucide-react";
import type { WorkOrder } from "../../api/client";

interface BrandedInvoiceLine {
  item: string;
  qty: number | string;
  rate: number | string;
}

interface BrandedInvoiceProps {
  lines?: BrandedInvoiceLine[];
  invoiceLabel?: string;
  wo?: WorkOrder | null;
}

const FALLBACK_LINES: BrandedInvoiceLine[] = [
  { item: "Compressor capacitor — replace", qty: 1, rate: 92.0 },
  { item: "Contactor — replace", qty: 1, rate: 48.0 },
  { item: "Labor · diagnose & repair", qty: 3.0, rate: 95.0 },
];

const fmtMoney = (n: number | string) =>
  "$" +
  (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtQty = (n: number | string) => {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
};

function todayStr() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dueDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function extractEntities(wo: WorkOrder | null | undefined) {
  const entities = (wo?.classification?.entities ?? {}) as Record<string, unknown>;

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = entities[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  // Try to pull useful fields from raw_request as last resort
  const raw = wo?.raw_request ?? "";

  // Client / billed-to
  const clientName =
    pick("client", "client_name", "customer", "company", "property_manager", "billed_to", "location") ??
    (() => {
      const m = raw.match(/From:\s*\S+@(\S+)/i);
      return m ? m[1].split(".")[0] : null;
    })();

  const clientEmail =
    pick("client_email", "customer_email", "email", "to", "dispatch_email") ??
    (() => {
      const m = raw.match(/To:\s*(\S+@\S+)/i);
      return m ? m[1] : null;
    })();

  const clientContact =
    pick("contact", "site_contact", "attn", "attention") ?? null;

  const address =
    pick("address", "location", "site_address", "property_address") ??
    (() => {
      const m = raw.match(/\d+\s+[\w\s]+(?:Blvd|Ave|St|Dr|Rd|Court|Ct|Way|Lane|Ln)[^,\n]*/i);
      return m ? m[0].trim() : null;
    })();

  const po =
    pick("po", "po_number", "purchase_order", "po_reference") ??
    (() => {
      const m = raw.match(/PO\s*(?:number|#)?:?\s*([\w-]+)/i);
      return m ? m[1] : null;
    })();

  const terms =
    pick("terms", "payment_terms", "net_terms") ??
    (() => {
      const m = raw.match(/Net\s*(\d+)/i);
      return m ? `Net ${m[1]}` : null;
    })();

  const rate =
    pick("rate", "hourly_rate", "labor_rate") ??
    (() => {
      const m = raw.match(/\$(\d+)\/hr/i);
      return m ? `$${m[1]}/hr` : null;
    })();

  // Vendor / billed-by — try to get from raw "To:" field domain
  const vendorEmail =
    pick("vendor_email", "dispatch_email", "from_email") ??
    (() => {
      const m = raw.match(/To:\s*(\S+@\S+)/i);
      return m ? m[1] : null;
    })();

  return { clientName, clientEmail, clientContact, address, po, terms, rate, vendorEmail };
}

export default function BrandedInvoice({
  lines = FALLBACK_LINES,
  invoiceLabel = "INV",
  wo,
}: BrandedInvoiceProps) {
  const subtotal = lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0),
    0,
  );

  const { clientName, clientEmail, clientContact, address, po, terms, vendorEmail } = extractEntities(wo);

  const today = todayStr();
  const due = dueDateStr();

  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--color-hairline)] bg-white">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-6 px-8 pt-9 pb-7">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
            <Wrench size={22} strokeWidth={1.75} />
          </span>
          <div>
            <div className="font-display text-[18px] font-semibold tracking-tight text-[var(--color-ink)]">
              {vendorEmail ? vendorEmail.split("@")[1]?.split(".")[0]?.toUpperCase() + " Services" : "Field Services"}
            </div>
            {vendorEmail && (
              <div className="mt-0.5 text-[12.5px] text-[var(--color-ink-2)]">{vendorEmail}</div>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="font-display text-[28px] font-semibold tracking-tight text-[var(--color-ink)]">
            Invoice
          </div>
          <div className="num mt-0.5 text-[13px] uppercase tracking-wide text-[var(--color-ink-3)]">
            {invoiceLabel}
          </div>
          <div className="mt-3 space-y-1 text-[12.5px]">
            <div className="text-[var(--color-ink-2)]">
              Issued <span className="num text-[var(--color-ink)]">{today}</span>
            </div>
            <div className="text-[var(--color-ink-2)]">
              Due <span className="num font-medium text-[var(--color-ink)]">{due}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-8 h-px bg-[var(--color-hairline)]" />

      {/* ── Billed by / Billed to / Details ── */}
      <div className="grid grid-cols-1 gap-7 px-8 py-7 sm:grid-cols-3">
        <div>
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Billed by
          </div>
          <div className="text-[13.5px] font-medium text-[var(--color-ink)]">
            {vendorEmail ? vendorEmail.split("@")[1]?.split(".")[0]?.toUpperCase() + " Services" : "Field Services"}
          </div>
          {vendorEmail && (
            <div className="mt-1 text-[13px] text-[var(--color-ink-2)]">{vendorEmail}</div>
          )}
        </div>

        <div>
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Billed to
          </div>
          {clientName ? (
            <div className="text-[13.5px] font-medium text-[var(--color-ink)]">{clientName}</div>
          ) : null}
          <div className="mt-1 space-y-0.5 text-[13px] text-[var(--color-ink-2)]">
            {clientContact && <div>Attn: {clientContact}</div>}
            {clientEmail && <div>{clientEmail}</div>}
          </div>
          {address && (
            <div className="mt-2 text-[12px] text-[var(--color-ink-3)]">{address}</div>
          )}
        </div>

        <div>
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Details
          </div>
          <dl className="flex flex-col gap-2">
            {[
              { label: "Invoice date", value: today },
              { label: "Due date", value: due },
              po ? { label: "PO reference", value: po } : null,
              terms ? { label: "Terms", value: terms } : null,
            ]
              .filter((x): x is { label: string; value: string } => x !== null)
              .map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[12.5px] text-[var(--color-ink-2)]">{label}</dt>
                  <dd className="num text-[12.5px] text-[var(--color-ink)]">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      <div className="mx-8 h-px bg-[var(--color-hairline)]" />

      {/* ── Line items ── */}
      <div className="px-8 py-7">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-[var(--color-hairline)]">
              {["Item", "Qty", "Rate", "Amount"].map((h, i) => (
                <th
                  key={h}
                  className={
                    "pb-3 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)] " +
                    (i === 0 ? "text-left" : "text-right")
                  }
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const amount = (Number(l.qty) || 0) * (Number(l.rate) || 0);
              return (
                <tr
                  key={i}
                  className="border-b border-[var(--color-hairline)] last:border-b-0"
                >
                  <td className="py-3.5 pr-4 text-[13.5px] text-[var(--color-ink)]">{l.item}</td>
                  <td className="num py-3.5 text-right text-[13.5px] text-[var(--color-ink-2)]">{fmtQty(l.qty)}</td>
                  <td className="num py-3.5 text-right text-[13.5px] text-[var(--color-ink-2)]">{fmtMoney(l.rate)}</td>
                  <td className="num py-3.5 text-right text-[13.5px] font-medium text-[var(--color-ink)]">{fmtMoney(amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-[230px] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-[13px] text-[var(--color-ink-2)]">Subtotal</dt>
              <dd className="num text-[13px] text-[var(--color-ink)]">{fmtMoney(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between border-t-2 border-[var(--color-hairline)] pt-3">
              <dt className="text-[14.5px] font-semibold text-[var(--color-ink)]">Total due</dt>
              <dd className="num text-[22px] font-semibold text-[var(--color-accent)]">{fmtMoney(subtotal)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-[var(--color-hairline)] px-8 py-5">
        <div className="text-[12.5px] text-[var(--color-ink-2)]">
          {terms ? <span className="font-medium text-[var(--color-ink)]">{terms}</span> : "Net 30"}
          {" · "}due {due}{" · "}Reference{" "}
          <span className="num text-[var(--color-ink)]">{invoiceLabel}</span>
        </div>
        {vendorEmail && (
          <div className="mt-1 text-[12px] text-[var(--color-ink-3)]">
            Thank you for the business — questions? {vendorEmail}
          </div>
        )}
      </div>
    </div>
  );
}
