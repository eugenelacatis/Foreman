import { Wrench } from "lucide-react";

interface InvoiceLine {
  item: string;
  qty: number;
  rate: number;
}

const LINES: InvoiceLine[] = [
  { item: "Compressor capacitor — replace", qty: 1, rate: 92.0 },
  { item: "Contactor — replace", qty: 1, rate: 48.0 },
  { item: "Labor · diagnose & repair", qty: 3.0, rate: 95.0 },
];

const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function BrandedInvoice() {
  const subtotal = LINES.reduce((s, l) => s + l.qty * l.rate, 0)
  const tax = 0
  const total = subtotal + tax

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-8 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
            <Wrench size={20} strokeWidth={2} />
          </span>
          <div>
            <div className="font-display text-[17px] font-semibold tracking-tight text-[var(--color-ink)]">
              R&amp;K HVAC Services
            </div>
            <div className="text-[12.5px] text-[var(--color-ink-2)]">
              ray@rkhvacservices.com <span className="text-[var(--color-ink-3)]">·</span> (555)
              014-2231
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[20px] font-semibold tracking-tight text-[var(--color-ink)]">
            Invoice
          </div>
          <div className="num text-[12.5px] uppercase tracking-wide text-[var(--color-ink-3)]">
            INV-1041
          </div>
        </div>
      </div>

      <div className="mx-8 h-px bg-[var(--color-hairline)]" />

      {/* ── Billed to · Details ── */}
      <div className="grid grid-cols-1 gap-8 px-8 py-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
            Billed to
          </div>
          <div className="text-[14px] font-medium text-[var(--color-ink)]">
            Maplewood HVAC &amp; Refrigeration
          </div>
          <div className="text-[13px] text-[var(--color-ink-2)]">Attn: Dana Reyes</div>
          <div className="text-[13px] text-[var(--color-ink-2)]">dispatch@maplewoodhvac.com</div>
          <div className="mt-2 text-[12.5px] text-[var(--color-ink-3)]">
            Service location: 412 Cedar Court, Unit 2B
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
            Details
          </div>
          <dl className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[13px] text-[var(--color-ink-2)]">Issued</dt>
              <dd className="num text-[13px] text-[var(--color-ink)]">Jun 19, 2026</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[13px] text-[var(--color-ink-2)]">Due</dt>
              <dd className="num text-[13px] text-[var(--color-ink)]">Jul 19, 2026</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[13px] text-[var(--color-ink-2)]">PO</dt>
              <dd className="num text-[13px] text-[var(--color-ink)]">MW-1041</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mx-8 h-px bg-[var(--color-hairline)]" />

      {/* ── Line items ── */}
      <div className="px-8 py-6">
        <div className="overflow-hidden rounded-[8px] border border-[var(--color-hairline)]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#fafbfd]">
                <th className="px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Description
                </th>
                <th className="px-4 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Qty
                </th>
                <th className="px-4 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Rate
                </th>
                <th className="px-4 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {LINES.map((l, i) => (
                <tr
                  key={l.item}
                  className={i > 0 ? 'border-t border-[var(--color-hairline)]' : ''}
                >
                  <td className="px-4 py-3 text-[13.5px] text-[var(--color-ink)]">{l.item}</td>
                  <td className="num px-4 py-3 text-right text-[13px] text-[var(--color-ink-2)]">
                    {fmtQty(l.qty)}
                  </td>
                  <td className="num px-4 py-3 text-right text-[13px] text-[var(--color-ink-2)]">
                    {fmtMoney(l.rate)}
                  </td>
                  <td className="num px-4 py-3 text-right text-[13.5px] text-[var(--color-ink)]">
                    {fmtMoney(l.qty * l.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <dl className="flex w-full max-w-[260px] flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <dt className="text-[13px] text-[var(--color-ink-2)]">Subtotal</dt>
              <dd className="num text-[13px] text-[var(--color-ink)]">{fmtMoney(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[13px] text-[var(--color-ink-2)]">Tax</dt>
              <dd className="num text-[13px] text-[var(--color-ink)]">{fmtMoney(tax)}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-[var(--color-hairline)] pt-2">
              <dt className="text-[13.5px] font-medium text-[var(--color-ink)]">Total due</dt>
              <dd className="num text-[17px] font-semibold text-[var(--color-accent)]">
                {fmtMoney(total)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ── Payment block ── */}
      <div className="mx-8 mb-6 rounded-[8px] bg-[var(--color-accent-tint)] px-5 py-4">
        <div className="text-[13px] font-medium text-[var(--color-ink)]">
          Payment <span className="text-[var(--color-ink-3)]">·</span>{' '}
          <span className="text-[var(--color-ink-2)]">Net 30, due Jul 19, 2026.</span>
        </div>
        <div className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-2)]">
          Pay by check to R&amp;K HVAC Services, or ACH (routing &amp; account on file). Reference{' '}
          <span className="num text-[var(--color-ink)]">INV-1041</span>.
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-[var(--color-hairline)] px-8 py-4 text-center text-[12px] text-[var(--color-ink-3)]">
        Thanks for the work — questions? ray@rkhvacservices.com
      </div>
    </div>
  )
}
