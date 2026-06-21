import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  Loader2,
  Check,
  Paperclip,
  Mail,
  Mic,
  Send,
  Plus,
  RotateCcw,
  Calendar,
  Clock,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import BrandedInvoice from "./BrandedInvoice";
import PricingView from "./PricingView";
import { getWorkOrder, approveStage } from "../../api/client";
import type { WorkOrder } from "../../api/client";

/* ============================================================
   Shared types
   ============================================================ */
type StageKey = "inbound" | "schedule" | "draft" | "approve";
type StepKey =
  | "inbound"
  | "schedule"
  | "postjob"
  | "invoice"
  | "approved";
type ReasoningState = "done" | "spin" | "pending";

interface Stage {
  key: StageKey;
  label: string;
  steps: StepKey[];
}

interface ReasoningItem {
  state: ReasoningState;
  label: string;
  detail?: string;
}

interface InvoiceLine {
  id: string;
  item: string;
  qty: number | string;
  rate: number | string;
  flagged: boolean;
}

/* ============================================================
   Constants + helpers
   ============================================================ */
const STAGES: Stage[] = [
  { key: "inbound", label: "Inbound", steps: ["inbound"] },
  { key: "schedule", label: "Schedule", steps: ["schedule"] },
  { key: "draft", label: "Draft", steps: ["postjob", "invoice"] },
  { key: "approve", label: "Approve", steps: ["approved"] },
];

const STEP_TO_STAGE: Record<StepKey, StageKey> = STAGES.reduce(
  (m, s) => {
    s.steps.forEach((step) => (m[step] = s.key));
    return m;
  },
  {} as Record<StepKey, StageKey>,
);

const FILE_NAME = "work-order-WO-1041.pdf";

const SEED_LINES: InvoiceLine[] = [
  { id: "li-1", item: "Compressor capacitor — replace", qty: 1, rate: 92, flagged: false },
  { id: "li-2", item: "Contactor — replace", qty: 1, rate: 48, flagged: false },
  { id: "li-3", item: "Labor · diagnose & repair", qty: 3.0, rate: 95, flagged: true },
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

function toInvoiceLine(
  raw: Record<string, unknown>,
  idx: number,
  laborFlagged: boolean,
): InvoiceLine {
  const item = String(raw.description ?? raw.item ?? raw.name ?? `Item ${idx + 1}`);
  const qty = Number(raw.qty ?? raw.quantity ?? 1);
  const rate = Number(raw.rate ?? raw.unit_price ?? raw.price ?? raw.amount ?? 0);
  const flagged = laborFlagged && /labor/i.test(item);
  return { id: `li-${idx}`, item, qty, rate, flagged };
}

function invoiceTotal(lines: InvoiceLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
}

/* ============================================================
   Shared UI primitives
   ============================================================ */
function Mark({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded-[4px] bg-[var(--color-accent-tint)] px-1 py-0.5 text-[var(--color-accent)]">
      {children}
    </mark>
  );
}

function FileChip({ name = FILE_NAME }: { name?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--color-hairline)] bg-white px-2 py-1">
      <Paperclip size={11} strokeWidth={2} className="text-[var(--color-ink-3)]" />
      <span className="num max-w-[260px] truncate text-[12px] text-[var(--color-ink)]" title={name}>
        {name}
      </span>
    </span>
  );
}

/* ============================================================
   Stage stepper (top progress row)
   ============================================================ */
function StageStepper({ currentStage }: { currentStage: StageKey }) {
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-2 overflow-x-auto sm:gap-3">
      {STAGES.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={
                  "grid h-5 w-5 place-items-center rounded-full text-[11px] font-medium leading-none transition-colors " +
                  (done || active
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-hairline)] bg-white text-[var(--color-ink-3)]")
                }
              >
                {done ? <Check size={11} strokeWidth={3} /> : <span className="num">{i + 1}</span>}
              </span>
              <span
                className={
                  "whitespace-nowrap text-[12.5px] font-medium " +
                  (active
                    ? "text-[var(--color-ink)]"
                    : done
                      ? "text-[var(--color-ink-2)]"
                      : "text-[var(--color-ink-3)]")
                }
              >
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 ? (
              <span
                className={
                  "h-px w-6 shrink-0 sm:w-8 " +
                  (i < currentIdx ? "bg-[var(--color-accent)]" : "bg-[var(--color-hairline)]")
                }
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Reasoning helpers (used in Step 1 + Step 3)
   ============================================================ */
function ReasoningRow({ state, label, detail }: ReasoningItem) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5">
        {state === "done" ? (
          <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--color-sent-tint)] text-[var(--color-sent-ink)]">
            <Check size={10} strokeWidth={3} />
          </span>
        ) : state === "spin" ? (
          <span className="grid h-4 w-4 place-items-center text-[var(--color-accent)]">
            <Loader2 size={13} strokeWidth={2} className="animate-spin" />
          </span>
        ) : (
          <span className="grid h-4 w-4 place-items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ink-3)]/40" />
          </span>
        )}
      </span>
      <span className="text-[13.5px] leading-snug">
        <span
          className={state === "pending" ? "text-[var(--color-ink-3)]" : "text-[var(--color-ink)]"}
        >
          {label}
        </span>
        {detail ? <span className="ml-1 text-[var(--color-ink-3)]">({detail})</span> : null}
      </span>
    </li>
  );
}

function ReasoningCard({ items }: { items: ReasoningItem[] }) {
  return (
    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
      <div className="border-b border-[var(--color-hairline)] px-4 py-3 text-[13.5px] font-medium text-[var(--color-ink)]">
        Agent reasoning
      </div>
      <ul className="flex flex-col gap-2.5 p-4">
        {items.map((it, i) => (
          <ReasoningRow key={i} {...it} />
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   Source cards
   ============================================================ */
function EmailSourceCard({ condensed = false }: { condensed?: boolean }) {
  return (
    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#f7f8fa] text-[var(--color-ink-2)]">
            <Mail size={13} strokeWidth={1.75} />
          </span>
          <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
            Source <span className="text-[var(--color-ink-3)]">· email only</span>
          </span>
        </div>
        <span className="num text-[11.5px] uppercase tracking-wide text-[var(--color-ink-3)]">
          WO-1041
        </span>
      </div>
      <div className="px-4 py-4">
        <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
          Email · Dana Reyes
        </div>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-ink)]">
          Subject: WO MW-1041 — AC unit, 2nd floor
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {condensed ? (
            <>
              Second-floor AC at Cedar Court quit again. We've got <Mark>PO MW-1041</Mark> set up.
              Same rate, <Mark>$95/hr</Mark>. <Mark>Net 30</Mark> as always.
            </>
          ) : (
            <>
              Hey — second-floor AC at the Cedar Court building quit again last night. Please get
              out there this week. We've got <Mark>PO MW-1041</Mark> set up for it. Same rate as
              usual, <Mark>$95/hr</Mark>. <Mark>Net 30</Mark> as always. Bill straight to dispatch
              when done.
              <br />— Dana
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function CombinedSourceCard() {
  return (
    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#f7f8fa] text-[var(--color-ink-2)]">
            <Mail size={13} strokeWidth={1.75} />
          </span>
          <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
            Sources <span className="text-[var(--color-ink-3)]">· email + voice note</span>
          </span>
        </div>
        <span className="num text-[11.5px] uppercase tracking-wide text-[var(--color-ink-3)]">
          WO-1041
        </span>
      </div>

      <div className="px-4 pt-4">
        <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
          Email · Dana Reyes
        </div>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          Second-floor AC at Cedar Court quit again. <Mark>PO MW-1041</Mark> set up. Same rate,{" "}
          <Mark>$95/hr</Mark>. <Mark>Net 30</Mark>.
        </p>
      </div>

      <div className="mx-4 my-4 h-px bg-[var(--color-hairline)]" />

      <div className="px-4 pb-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
          <Mic size={11} strokeWidth={2.25} className="text-[var(--color-accent)]" />
          Voice note · Ray (field tech)
        </div>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          "Hey, just finished up at Maplewood — the second-floor unit was tripping on a bad{" "}
          <Mark>compressor capacitor and contactor</Mark>, swapped both. Maybe{" "}
          <Mark>3 hours</Mark> total, mostly the diagnose part. All running good."
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   Step 1 — INBOUND READING
   ============================================================ */
interface Step1Props {
  onNext: () => void;
  wo: WorkOrder | null;
  polling: boolean;
  approving: boolean;
}

function Step1Inbound({ onNext, wo, polling, approving }: Step1Props) {
  // Mock animation fallback: runs only when there's no real classification yet
  const [mockDone, setMockDone] = useState(false);
  useEffect(() => {
    if (wo?.classification) return;
    const t = setTimeout(() => setMockDone(true), 2000);
    return () => clearTimeout(t);
  }, [wo?.classification]);

  const items = useMemo((): ReasoningItem[] => {
    const c = wo?.classification;
    if (c) {
      const result: ReasoningItem[] = [
        { state: "done", label: "Classified job", detail: c.job_type },
      ];
      c.completeness_flags.forEach((flag) =>
        result.push({ state: "done", label: "Extracted field", detail: flag }),
      );
      result.push({ state: "done", label: "Classification complete" });
      return result;
    }
    // Mock fallback with animation
    return [
      { state: "done", label: "Classified job", detail: "HVAC repair" },
      { state: "done", label: "Read location", detail: "2nd floor, Cedar Court" },
      { state: "done", label: "Read terms", detail: "PO, $95/hr, Net 30" },
      mockDone || !polling
        ? { state: "done", label: "Proposed a visit time", detail: "Wed 11 AM" }
        : { state: "spin", label: polling ? "Waiting for intake agent…" : "Proposing a visit time…" },
    ];
  }, [wo?.classification, mockDone, polling]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <Loader2 size={15} strokeWidth={2} className="animate-spin text-[var(--color-accent)]" />
        <span className="font-medium text-[var(--color-ink)]">Reading the work order…</span>
        <span className="text-[var(--color-ink-3)]">·</span>
        <span className="text-[var(--color-ink-2)]">
          {wo?.classification?.job_type ?? "Maplewood HVAC"}
        </span>
        <FileChip />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EmailSourceCard />
        <ReasoningCard items={items} />
      </div>

      <div className="flex items-center gap-2 rounded-[10px] border border-[var(--color-hairline)] bg-[#fafbfd] px-4 py-3 text-[13px] text-[var(--color-ink-2)]">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[var(--color-ink-3)]">
          <span className="text-[10px] font-bold">i</span>
        </span>
        No parts or invoice yet — the job hasn't happened.
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={approving}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-3.5 h-9 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4fd1] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {approving ? (
            <Loader2 size={13} strokeWidth={2} className="animate-spin" />
          ) : null}
          Schedule the visit
          {!approving ? <ChevronRight size={14} strokeWidth={2.25} /> : null}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Step 2 — SCHEDULE
   ============================================================ */
interface Step2Props {
  onNext: () => void;
  wo: WorkOrder | null;
  approving: boolean;
}

const MOCK_SLOTS = [
  { id: "tue", label: "Tue · 9:00 AM" },
  { id: "wed", label: "Wed · 11:00 AM" },
  { id: "thu", label: "Thu · 2:00 PM" },
];

function Step2Schedule({ onNext, wo, approving }: Step2Props) {
  const schedule = wo?.schedule;

  const slots = useMemo(() => {
    if (schedule?.proposed_times?.length) {
      return schedule.proposed_times.map((t, i) => ({ id: `slot-${i}`, label: t }));
    }
    return MOCK_SLOTS;
  }, [schedule?.proposed_times]);

  const defaultId = slots[1]?.id ?? slots[0]?.id ?? "";
  const [selected, setSelected] = useState<string>(defaultId);

  // Re-sync when slots arrive from backend
  useEffect(() => {
    setSelected(slots[1]?.id ?? slots[0]?.id ?? "");
  }, [slots]);

  const chosen = slots.find((s) => s.id === selected) ?? slots[0];

  // Outreach draft — backend returns dict; try common key names
  const draft = schedule?.outreach_draft as
    | { to?: string; recipient?: string; subject?: string; body?: string; content?: string }
    | undefined;
  const draftTo = draft?.to ?? draft?.recipient;
  const draftSubject = draft?.subject;
  const draftBody = draft?.body ?? draft?.content;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <div className="font-display text-[18px] font-semibold tracking-tight text-[var(--color-ink)]">
          Schedule the visit
        </div>
        <span className="num text-[13px] text-[var(--color-ink-3)]">· WO-1041</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-[13.5px] font-medium text-[var(--color-ink)]">
            <Calendar size={14} strokeWidth={2} className="text-[var(--color-ink-2)]" />
            Proposed times
          </div>
          <div className="flex flex-col gap-2">
            {slots.map((s) => {
              const active = selected === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={
                    "flex items-center gap-2 rounded-[8px] border px-3 h-10 text-left text-[13.5px] transition-colors " +
                    (active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium"
                      : "border-[var(--color-hairline)] bg-white text-[var(--color-ink)] hover:bg-[#fafbfd]")
                  }
                >
                  <Clock size={13} strokeWidth={2} className="opacity-80" />
                  <span className="num flex-1">{s.label}</span>
                  {active ? <Check size={13} strokeWidth={2.5} /> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12.5px] text-[var(--color-ink-3)]">
            The agent suggests these based on Ray's calendar.
          </p>
        </div>

        <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#f7f8fa] text-[var(--color-ink-2)]">
                <Mail size={13} strokeWidth={1.75} />
              </span>
              <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
                Outreach draft <span className="text-[var(--color-ink-3)]">· to tenant</span>
              </span>
            </div>
            <span className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-3)]">
              Draft
            </span>
          </div>
          <div className="flex flex-col gap-2 px-4 py-4 text-[13.5px]">
            <div className="flex gap-2">
              <span className="w-14 shrink-0 text-[var(--color-ink-3)]">To</span>
              <span className="text-[var(--color-ink)]">
                {draftTo ?? "dispatch@maplewoodhvac.com"}{" "}
                <span className="text-[var(--color-ink-3)]">· cc tenant — 2B</span>
              </span>
            </div>
            <div className="flex gap-2">
              <span className="w-14 shrink-0 text-[var(--color-ink-3)]">Subject</span>
              <span className="text-[var(--color-ink)]">
                {draftSubject ?? (
                  <>
                    AC repair visit — <span className="num">{chosen?.label}</span>
                  </>
                )}
              </span>
            </div>
            <div className="mt-2 border-t border-[var(--color-hairline)] pt-3 text-[var(--color-ink-2)] leading-relaxed">
              {draftBody ?? (
                <>
                  Hi Dana — we'd like to come out{" "}
                  <span className="num text-[var(--color-ink)]">{chosen?.label}</span> to look at
                  the 2nd-floor unit (Cedar Court, 2B). Reply if that time doesn't work and we'll
                  find another. Referencing PO{" "}
                  <span className="num text-[var(--color-ink)]">MW-1041</span>.
                  <br />
                  <br />
                  Thanks,
                  <br />
                  R&amp;K HVAC Services
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={approving}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-3.5 h-9 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4fd1] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {approving ? (
            <Loader2 size={13} strokeWidth={2} className="animate-spin" />
          ) : null}
          Approve &amp; send
          {!approving ? <ChevronRight size={14} strokeWidth={2.25} /> : null}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Step 3 — POST-JOB READING (email + voice note)
   ============================================================ */
function Step3PostJob({ onNext }: { onNext: () => void }) {
  const [items, setItems] = useState<ReasoningItem[]>([
    { state: "done", label: "Re-read the work order" },
    { state: "done", label: "Heard the voice note" },
    { state: "done", label: "Extracted parts", detail: "capacitor, contactor" },
    { state: "done", label: "Read labor", detail: "~3 hrs" },
    { state: "spin", label: "Checking Maplewood's past invoices…" },
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setItems((arr) =>
        arr.map((it, i) =>
          i === arr.length - 1
            ? {
                state: "done",
                label: "Checked Maplewood's past invoices",
                detail: "matched last 3",
              }
            : it,
        ),
      );
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 rounded-[10px] border border-[#bbf7d0] bg-[var(--color-sent-tint)] px-4 py-2.5">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-sent-ink)] text-white">
          <Check size={12} strokeWidth={3} />
        </span>
        <span className="text-[13px] font-medium text-[var(--color-sent-ink)]">
          Job complete <span className="opacity-60">·</span> voice note received from Ray
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <Loader2 size={15} strokeWidth={2} className="animate-spin text-[var(--color-accent)]" />
        <span className="font-medium text-[var(--color-ink)]">Drafting the invoice…</span>
        <span className="text-[var(--color-ink-3)]">·</span>
        <span className="text-[var(--color-ink-2)]">now using the voice note</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CombinedSourceCard />
        <ReasoningCard items={items} />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-3.5 h-9 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4fd1]"
        >
          See the invoice
          <ChevronRight size={14} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Step 4 — INVOICE (document default, edit toggle)
   ============================================================ */
type InvoiceTab = "document" | "edit" | "pricing";

interface Step4Props {
  onApprove: () => void;
  onBack?: () => void;
  wo: WorkOrder | null;
  approving: boolean;
}

function Step4Invoice({ onApprove, onBack, wo, approving }: Step4Props) {
  const completenessFlags = wo?.classification?.completeness_flags ?? [];
  const laborFlagged = completenessFlags.includes("labor_rate");

  const apiLines = useMemo((): InvoiceLine[] | null => {
    const items = wo?.invoice?.line_items;
    if (!items?.length) return null;
    return items.map((raw, i) => toInvoiceLine(raw, i, laborFlagged));
  }, [wo?.invoice?.line_items, laborFlagged]);

  const [tab, setTab] = useState<InvoiceTab>("document");
  const [lines, setLines] = useState<InvoiceLine[]>(apiLines ?? SEED_LINES);
  const laborInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (apiLines) setLines(apiLines);
  }, [apiLines]);

  useEffect(() => {
    if (tab === "edit") laborInputRef.current?.focus();
  }, [tab]);

  const total = useMemo(() => invoiceTotal(lines), [lines]);
  const invoiceLabel = wo?.invoice?.invoice_id ?? "INV-1041";

  const update = (id: string, patch: Partial<InvoiceLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((ls) => [
      ...ls,
      {
        id: "li-" + (Math.max(0, ...ls.map((l) => Number(l.id.split("-")[1]) || 0)) + 1),
        item: "",
        qty: 1,
        rate: 0,
        flagged: false,
      },
    ]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: back link (document tab only) */}
        {onBack && tab === "document" ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
          >
            <ChevronLeft size={14} strokeWidth={2} />
            Back to dashboard
          </button>
        ) : (
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="font-display text-[17px] font-semibold tracking-tight text-[var(--color-ink)]">
              Invoice draft
            </div>
            <span className="num text-[13px] text-[var(--color-ink-3)]">· {invoiceLabel}</span>
          </div>
        )}

        {/* Center: tab toggle */}
        <div className="flex items-center rounded-[8px] border border-[var(--color-hairline)] bg-[#fafbfd] p-0.5">
          {(["document", "edit", "pricing"] as InvoiceTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "rounded-[6px] px-3 h-7 text-[12.5px] font-medium capitalize transition-colors " +
                (tab === t
                  ? "bg-white text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]")
              }
            >
              {t}
            </button>
          ))}
        </div>

        {/* Right: approve */}
        <button
          type="button"
          onClick={onApprove}
          disabled={approving}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-3.5 h-9 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4fd1] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {approving ? (
            <Loader2 size={13} strokeWidth={2} className="animate-spin" />
          ) : null}
          Approve invoice
          {!approving ? <ChevronRight size={14} strokeWidth={2.25} /> : null}
        </button>
      </div>

      {tab === "document" ? (
        <BrandedInvoice lines={lines} invoiceLabel={invoiceLabel} />
      ) : tab === "edit" ? (
        <EditSplit
          lines={lines}
          total={total}
          update={update}
          addLine={addLine}
          laborInputRef={laborInputRef}
          invoiceLabel={invoiceLabel}
        />
      ) : (
        <PricingView lines={lines} />
      )}
    </div>
  );
}

interface EditSplitProps {
  lines: InvoiceLine[];
  total: number;
  update: (id: string, patch: Partial<InvoiceLine>) => void;
  addLine: () => void;
  laborInputRef: RefObject<HTMLInputElement>;
  invoiceLabel: string;
}

function EditSplit({ lines, total, update, addLine, laborInputRef, invoiceLabel }: EditSplitProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
        <div className="border-b border-[var(--color-hairline)] px-4 py-3 text-[13.5px] font-medium text-[var(--color-ink)]">
          Line items
        </div>

        <div className="grid grid-cols-[1fr_64px_96px] gap-3 border-b border-[var(--color-hairline)] px-4 py-2 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Rate</span>
        </div>

        {lines.map((l) => {
          const flagged = l.flagged;
          return (
            <div
              key={l.id}
              className="flex flex-col gap-1 border-t border-[var(--color-hairline)] px-4 py-2.5"
            >
              <div className="grid grid-cols-[1fr_64px_96px] gap-3">
                <input
                  type="text"
                  value={l.item}
                  onChange={(e) => update(l.id, { item: e.target.value })}
                  placeholder="Description"
                  className="h-8 w-full rounded-[6px] border border-transparent bg-transparent px-2 text-[13.5px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] outline-none hover:border-[var(--color-hairline)] focus:border-[var(--color-ink-3)] focus:bg-white"
                />
                <input
                  type="number"
                  step="0.5"
                  value={l.qty}
                  onChange={(e) => update(l.id, { qty: e.target.value })}
                  className="num h-8 w-full rounded-[6px] border border-transparent bg-transparent px-2 text-right text-[13.5px] text-[var(--color-ink)] outline-none hover:border-[var(--color-hairline)] focus:border-[var(--color-ink-3)] focus:bg-white"
                />
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[12.5px] text-[var(--color-ink-3)]">
                    $
                  </span>
                  <input
                    ref={flagged ? laborInputRef : undefined}
                    type="number"
                    step="0.01"
                    value={l.rate}
                    onChange={(e) => update(l.id, { rate: e.target.value })}
                    className={
                      "num h-8 w-full rounded-[6px] border bg-white pl-4 pr-2 text-right text-[13.5px] outline-none transition-colors " +
                      (flagged
                        ? "border-[var(--color-accent)] text-[var(--color-accent)] ring-2 ring-[var(--color-accent-15)] focus:ring-[var(--color-accent-25)]"
                        : "border-transparent text-[var(--color-ink)] hover:border-[var(--color-hairline)] focus:border-[var(--color-ink-3)]")
                    }
                  />
                </div>
              </div>
              {flagged ? (
                <div className="text-[11.5px] leading-tight text-[var(--color-accent)]">
                  Confirm the labor rate — the only flagged field.
                </div>
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addLine}
          className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-[var(--color-hairline)] px-4 py-2.5 text-[13px] text-[var(--color-ink-2)] transition-colors hover:bg-[#fafbfd] hover:text-[var(--color-ink)]"
        >
          <Plus size={13} strokeWidth={2} />
          Add line item
        </button>
      </div>

      <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
          <span className="text-[13.5px] font-medium text-[var(--color-ink)]">Live preview</span>
          <span className="num text-[11.5px] uppercase tracking-wide text-[var(--color-ink-3)]">
            {invoiceLabel}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
              <Wrench size={13} strokeWidth={2} />
            </span>
            <span className="font-display text-[13.5px] font-semibold text-[var(--color-ink)]">
              R&amp;K HVAC
            </span>
          </div>
          <div className="text-right text-[11.5px] text-[var(--color-ink-3)]">
            Maplewood HVAC <span className="num">· PO MW-1041</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_44px_64px_72px] gap-2 px-4 pt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="flex flex-col px-4 pb-2">
          {lines.map((l) => {
            const amount = (Number(l.qty) || 0) * (Number(l.rate) || 0);
            return (
              <div
                key={l.id}
                className="grid grid-cols-[1fr_44px_64px_72px] gap-2 border-t border-[var(--color-hairline)] py-1.5 text-[12.5px] first:border-t-0"
              >
                <span className="truncate text-[var(--color-ink)]">{l.item || "—"}</span>
                <span className="num text-right text-[var(--color-ink-2)]">{fmtQty(l.qty)}</span>
                <span className="num text-right text-[var(--color-ink-2)]">{fmtMoney(l.rate)}</span>
                <span className="num text-right text-[var(--color-ink)]">{fmtMoney(amount)}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-hairline)] bg-[#fafbfd] px-4 py-3">
          <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
            Total due
          </span>
          <span className="num text-[16px] font-semibold text-[var(--color-accent)]">
            {fmtMoney(total)}
          </span>
        </div>

        <div className="m-4 rounded-[8px] bg-[var(--color-accent-tint)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
          <span className="font-medium text-[var(--color-ink)]">Net 30</span> · due Jul 19, 2026.
          Reference <span className="num text-[var(--color-ink)]">{invoiceLabel}</span>.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Step 5 — APPROVED
   ============================================================ */
interface Step5Props {
  onReset: () => void;
  wo: WorkOrder | null;
}

function Step5Approved({ onReset, wo }: Step5Props) {
  const [sent, setSent] = useState(false);

  const total = useMemo(() => {
    const items = wo?.invoice?.line_items;
    if (!items?.length) return 425; // mock fallback
    return items.reduce((s, raw) => {
      const qty = Number(raw.qty ?? raw.quantity ?? 1);
      const rate = Number(raw.rate ?? raw.unit_price ?? raw.price ?? 0);
      const amount = Number(raw.amount ?? qty * rate);
      return s + amount;
    }, 0);
  }, [wo?.invoice?.line_items]);

  const invoiceLabel = wo?.invoice?.invoice_id ?? "INV-1041";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-sent-tint)] text-[var(--color-sent-ink)]">
          <Check size={18} strokeWidth={2.5} />
        </span>
        <div>
          <div className="font-display text-[18px] font-semibold tracking-tight text-[var(--color-ink)]">
            Invoice approved
          </div>
          <div className="text-[13px] text-[var(--color-ink-2)]">
            Maplewood HVAC <span className="text-[var(--color-ink-3)]">·</span>{" "}
            <span className="num">WO-1041</span>{" "}
            <span className="text-[var(--color-ink-3)]">·</span>{" "}
            <span className="num text-[var(--color-ink)]">{fmtMoney(total)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white p-5">
        <p className="text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          Saved as draft. The agent stops here — you send it.{" "}
          <span className="text-[var(--color-ink)] font-medium">It never sends on its own.</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={sent}
            onClick={() => setSent(true)}
            className={
              "inline-flex items-center gap-1.5 rounded-[8px] px-3.5 h-9 text-[13px] font-medium transition-colors " +
              (sent
                ? "bg-[var(--color-sent-tint)] text-[var(--color-sent-ink)] cursor-default"
                : "bg-[var(--color-accent)] text-white hover:bg-[#1d4fd1]")
            }
          >
            {sent ? (
              <>
                <Check size={13} strokeWidth={2.5} />
                Sent
              </>
            ) : (
              <>
                <Send size={13} strokeWidth={2} />
                Send to Maplewood
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--color-hairline)] px-3 h-9 text-[13px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[#fafbfd] hover:border-[var(--color-ink-3)]"
          >
            <RotateCcw size={13} strokeWidth={2} />
            Run again
          </button>
        </div>

        {wo?.invoice?.invoice_id ? (
          <p className="mt-4 text-[12px] text-[var(--color-ink-3)]">
            Invoice <span className="num">{invoiceLabel}</span> saved to work order.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ============================================================
   Default export — the flow container
   ============================================================ */
interface WorkOrderToInvoiceFlowProps {
  onBack?: () => void;
  workOrderId?: string | null;
}

export default function WorkOrderToInvoiceFlow({
  onBack,
  workOrderId,
}: WorkOrderToInvoiceFlowProps) {
  const [step, setStep] = useState<StepKey>("inbound");
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [approving, setApproving] = useState(false);
  const stage = STEP_TO_STAGE[step];

  // Poll getWorkOrder every 500ms while on step 1, until classification is populated.
  // The intake agent runs after WO creation; we poll to pick up its output.
  useEffect(() => {
    if (!workOrderId || step !== "inbound") return;

    let cancelled = false;
    let tid: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const data = await getWorkOrder(workOrderId);
        if (cancelled) return;
        setWo(data);
        if (!data.classification) {
          tid = setTimeout(poll, 500);
        }
      } catch {
        if (!cancelled) tid = setTimeout(poll, 2000);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [workOrderId, step]);

  // Approve a stage then advance to the next step.
  // If no workOrderId or the call fails, silently advance (mock fallback).
  const advance = useCallback(
    async (
      approvalStage: "intake" | "scheduling" | "invoice" | null,
      nextStep: StepKey,
    ) => {
      if (approvalStage && workOrderId) {
        setApproving(true);
        try {
          const updated = await approveStage(workOrderId, approvalStage);
          setWo(updated);
        } catch (err) {
          console.warn("approveStage failed, continuing in mock mode:", err);
        } finally {
          setApproving(false);
        }
      }
      setStep(nextStep);
    },
    [workOrderId],
  );

  const pollingClassification = !!workOrderId && step === "inbound" && !wo?.classification;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
          >
            <ChevronLeft size={14} strokeWidth={2} />
            Back to dashboard
          </button>
        ) : (
          <span />
        )}
        <StageStepper currentStage={stage} />
      </div>

      {step === "inbound" ? (
        <Step1Inbound
          onNext={() => advance("intake", "schedule")}
          wo={wo}
          polling={pollingClassification}
          approving={approving}
        />
      ) : step === "schedule" ? (
        <Step2Schedule
          onNext={() => advance("scheduling", "postjob")}
          wo={wo}
          approving={approving}
        />
      ) : step === "postjob" ? (
        <Step3PostJob onNext={() => setStep("invoice")} />
      ) : step === "invoice" ? (
        <Step4Invoice
          onApprove={() => advance("invoice", "approved")}
          onBack={onBack}
          wo={wo}
          approving={approving}
        />
      ) : (
        <Step5Approved
          onReset={() => {
            setStep("inbound");
            setWo(null);
          }}
          wo={wo}
        />
      )}
    </div>
  );
}
