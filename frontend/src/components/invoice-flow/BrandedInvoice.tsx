import { Wrench } from "lucide-react";

interface BrandedInvoiceLine {
  item: string;
  qty: number | string;
  rate: number | string;
}

interface BrandedInvoiceProps {
  lines?: BrandedInvoiceLine[];
  invoiceLabel?: string;
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

export default function BrandedInvoice({
  lines = FALLBACK_LINES,
  invoiceLabel = "INV-1041",
}: BrandedInvoiceProps) {
  const subtotal = lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0),
    0,
  );

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
              R&amp;K HVAC Services
            </div>
            <div className="mt-0.5 text-[12.5px] text-[var(--color-ink-2)]">
              ray@rkhvacservices.com
            </div>
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
              Issued{" "}
              <span className="num text-[var(--color-ink)]">Jun 19, 2026</span>
            </div>
            <div className="text-[var(--color-ink-2)]">
              Due{" "}
              <span className="num font-medium text-[var(--color-ink)]">
                Jul 19, 2026
              </span>
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
            R&amp;K HVAC Services
          </div>
          <div className="mt-1 space-y-0.5 text-[13px] text-[var(--color-ink-2)]">
            <div>ray@rkhvacservices.com</div>
            <div>(555) 014-2231</div>
          </div>
        </div>

        <div>
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Billed to
          </div>
          <div className="text-[13.5px] font-medium text-[var(--color-ink)]">
            Maplewood HVAC &amp; Refrigeration
          </div>
          <div className="mt-1 space-y-0.5 text-[13px] text-[var(--color-ink-2)]">
            <div>Attn: Dana Reyes</div>
            <div>dispatch@maplewoodhvac.com</div>
          </div>
          <div className="mt-2 text-[12px] text-[var(--color-ink-3)]">
            412 Cedar Court, Unit 2B
          </div>
        </div>

        <div>
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Details
          </div>
          <dl className="flex flex-col gap-2">
            {[
              { label: "Invoice date", value: "Jun 19, 2026" },
              { label: "Due date", value: "Jul 19, 2026" },
              { label: "PO reference", value: "MW-1041" },
              { label: "Terms", value: "Net 30" },
            ].map(({ label, value }) => (
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
                  <td className="py-3.5 pr-4 text-[13.5px] text-[var(--color-ink)]">
                    {l.item}
                  </td>
                  <td className="num py-3.5 text-right text-[13.5px] text-[var(--color-ink-2)]">
                    {fmtQty(l.qty)}
                  </td>
                  <td className="num py-3.5 text-right text-[13.5px] text-[var(--color-ink-2)]">
                    {fmtMoney(l.rate)}
                  </td>
                  <td className="num py-3.5 text-right text-[13.5px] font-medium text-[var(--color-ink)]">
                    {fmtMoney(amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <dl className="w-[230px] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-[13px] text-[var(--color-ink-2)]">Subtotal</dt>
              <dd className="num text-[13px] text-[var(--color-ink)]">
                {fmtMoney(subtotal)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t-2 border-[var(--color-hairline)] pt-3">
              <dt className="text-[14.5px] font-semibold text-[var(--color-ink)]">
                Total due
              </dt>
              <dd className="num text-[22px] font-semibold text-[var(--color-accent)]">
                {fmtMoney(subtotal)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-[var(--color-hairline)] px-8 py-5">
        <div className="text-[12.5px] text-[var(--color-ink-2)]">
          <span className="font-medium text-[var(--color-ink)]">Net 30</span>
          {" · "}due Jul 19, 2026{" · "}Reference{" "}
          <span className="num text-[var(--color-ink)]">{invoiceLabel}</span>
        </div>
        <div className="mt-1 text-[12px] text-[var(--color-ink-3)]">
          Thank you for the business — questions? ray@rkhvacservices.com ·{" "}
          (555) 014-2231
        </div>
      </div>
    </div>
  );
}
