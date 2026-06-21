import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Shield,
  User,
} from "lucide-react";
import type { WorkOrder } from "../../api/client";
import ArmorIQGate from "./ArmorIQGate";

/* ============================================================
   Seam: composeOutreach
   Returns the live draft. Swap the body for an LLM call when
   the scheduling agent exposes a compose endpoint.
   ============================================================ */
interface OutreachMessage {
  to: string;
  channel: "email" | "sms";
  subject: string;
  body: string;
}

interface ComposeOptions {
  selectedSlotLabels: string[];
  includePO: boolean;
}

function composeOutreach(
  wo: WorkOrder | null,
  opts: ComposeOptions,
): OutreachMessage {
  const entities = (wo?.classification?.entities ?? {}) as Record<string, unknown>;

  const to = String(entities.email ?? "dispatch@maplewoodhvac.com");
  const channel: "email" | "sms" = "email";
  const address = String(entities.address ?? "Cedar Court, Unit 2B");
  const jobType = wo?.classification?.job_type ?? "AC repair";
  const poNumber = String(entities.po_number ?? entities.po ?? "MW-1041");
  const contact = String(entities.contact ?? entities.tenant ?? "Dana");

  const subject = `${jobType} — ${address}`;

  const { selectedSlotLabels: slots, includePO } = opts;
  const slotText =
    slots.length === 0
      ? "when we have availability"
      : slots.length === 1
        ? slots[0]
        : `${slots.slice(0, -1).join(", ")} or ${slots[slots.length - 1]}`;

  const poLine = includePO ? `\n\nThis job references PO ${poNumber}.` : "";

  const body =
    `Hi ${contact} —\n\n` +
    `We'd like to come out ${slotText} to service the 2nd-floor unit at ${address}. ` +
    `Please reply if none of those windows work and we'll find another time.` +
    poLine +
    `\n\nThanks,\nRay\nR&K HVAC Services`;

  return { to, channel, subject, body };
}

/* ============================================================
   Seam: getScheduleQuestions
   Returns the questions to show on the left panel. Swap for a
   server call when the scheduling agent exposes questions.
   ============================================================ */
interface SlotOption {
  id: string;
  label: string;
  defaultSelected: boolean;
}

interface ScheduleQuestion {
  id: "times" | "contact" | "po";
  label: string;
  why: string;
  type: "multislot" | "confirm-contact" | "toggle";
  options?: SlotOption[];
  contact?: string;
  defaultValue?: boolean;
}

function getScheduleQuestions(wo: WorkOrder | null): ScheduleQuestion[] {
  const entities = (wo?.classification?.entities ?? {}) as Record<string, unknown>;
  const contactName = String(entities.contact ?? "Dana Reyes");
  const email = String(entities.email ?? "dispatch@maplewoodhvac.com");
  const poNumber = String(entities.po_number ?? entities.po ?? "MW-1041");

  const proposed = wo?.schedule?.proposed_times;
  const slots: SlotOption[] = proposed?.length
    ? proposed.map((t, i) => ({ id: `slot-${i}`, label: t, defaultSelected: i < 2 }))
    : [
        { id: "tue", label: "Tue Jun 24 · 9–11 AM", defaultSelected: true },
        { id: "wed", label: "Wed Jun 25 · 1–3 PM", defaultSelected: true },
        { id: "thu", label: "Thu Jun 26 · 8–10 AM", defaultSelected: false },
      ];

  return [
    {
      id: "times",
      label: "Which times should I offer?",
      why: "The agent found 3 open windows on Ray's calendar that fit the building hours.",
      type: "multislot",
      options: slots,
    },
    {
      id: "contact",
      label: "Send to this contact?",
      why: `The agent read ${contactName} as the dispatch contact on the work order.`,
      type: "confirm-contact",
      contact: `${contactName} · ${email}`,
    },
    {
      id: "po",
      label: "Include PO number?",
      why: `Work order references PO ${poNumber} — including it ties the message to the scope.`,
      type: "toggle",
      defaultValue: true,
    },
  ];
}

/* ============================================================
   Question card
   ============================================================ */
interface QuestionCardProps {
  question: ScheduleQuestion;
  selectedSlots: Set<string>;
  onToggleSlot: (id: string) => void;
  contactConfirmed: boolean;
  onConfirmContact: () => void;
  includePO: boolean;
  onSetPO: (v: boolean) => void;
}

function QuestionCard({
  question,
  selectedSlots,
  onToggleSlot,
  contactConfirmed,
  onConfirmContact,
  includePO,
  onSetPO,
}: QuestionCardProps) {
  return (
    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white p-4">
      <div className="mb-0.5 text-[13.5px] font-medium text-[var(--color-ink)]">
        {question.label}
      </div>
      <p className="mb-3 text-[12.5px] leading-snug text-[var(--color-ink-3)]">
        {question.why}
      </p>

      {question.type === "multislot" && question.options && (
        <div className="flex flex-col gap-2">
          {question.options.map((opt) => {
            const active = selectedSlots.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onToggleSlot(opt.id)}
                className={
                  "flex h-9 items-center gap-2.5 rounded-[8px] border px-3 text-left text-[13px] transition-colors " +
                  (active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-tint)] font-medium text-[var(--color-accent)]"
                    : "border-[var(--color-hairline)] bg-white text-[var(--color-ink)] hover:bg-[#fafbfd]")
                }
              >
                <span
                  className={
                    "grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border transition-colors " +
                    (active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                      : "border-[var(--color-hairline)] bg-white")
                  }
                >
                  {active && <Check size={10} strokeWidth={3} className="text-white" />}
                </span>
                <span className="num flex-1">{opt.label}</span>
                <Calendar size={12} strokeWidth={1.75} className="shrink-0 opacity-40" />
              </button>
            );
          })}
        </div>
      )}

      {question.type === "confirm-contact" && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f7f8fa] text-[var(--color-ink-2)]">
              <User size={13} strokeWidth={1.75} />
            </span>
            <span className="num truncate text-[13px] text-[var(--color-ink)]">
              {question.contact}
            </span>
          </div>
          <button
            type="button"
            onClick={onConfirmContact}
            disabled={contactConfirmed}
            className={
              "shrink-0 rounded-[8px] border px-3 h-8 text-[12.5px] font-medium transition-colors " +
              (contactConfirmed
                ? "cursor-default border-[#bbf7d0] bg-[#ecfdf3] text-[#15803d]"
                : "border-[var(--color-hairline)] bg-white text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]")
            }
          >
            {contactConfirmed ? (
              <span className="flex items-center gap-1">
                <Check size={11} strokeWidth={3} />
                Confirmed
              </span>
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      )}

      {question.type === "toggle" && (
        <div className="flex items-center gap-2">
          {(["Yes", "No"] as const).map((label) => {
            const isYes = label === "Yes";
            const active = isYes ? includePO : !includePO;
            return (
              <button
                key={label}
                type="button"
                onClick={() => onSetPO(isYes)}
                className={
                  "rounded-[8px] border px-4 h-8 text-[13px] font-medium transition-colors " +
                  (active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-tint)] text-[var(--color-accent)]"
                    : "border-[var(--color-hairline)] bg-white text-[var(--color-ink-3)] hover:bg-[#fafbfd]")
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ScheduleStep — exported
   ============================================================ */
export interface ScheduleStepProps {
  onNext: () => void;
  onBack?: () => void;
  wo: WorkOrder | null;
  approving: boolean;
}

export default function ScheduleStep({
  onNext,
  onBack,
  wo,
  approving,
}: ScheduleStepProps) {
  const questions = useMemo(() => getScheduleQuestions(wo), [wo]);

  const timesQ = questions.find((q) => q.id === "times");
  const poQ = questions.find((q) => q.id === "po");

  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(
    () =>
      new Set(
        timesQ?.options?.filter((o) => o.defaultSelected).map((o) => o.id) ?? [],
      ),
  );
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [includePO, setIncludePO] = useState(poQ?.defaultValue ?? true);
  const [sent, setSent] = useState(false);

  const toggleSlot = (id: string) =>
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedSlotLabels = useMemo(() => {
    const opts = timesQ?.options ?? [];
    return opts.filter((o) => selectedSlots.has(o.id)).map((o) => o.label);
  }, [timesQ, selectedSlots]);

  const message = useMemo(
    () => composeOutreach(wo, { selectedSlotLabels, includePO }),
    [wo, selectedSlotLabels, includePO],
  );

  const handleSend = () => {
    setSent(true);
    setTimeout(onNext, 1500);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-baseline gap-2">
        <div className="font-display text-[18px] font-semibold tracking-tight text-[var(--color-ink)]">
          Outreach
        </div>
        <span className="num text-[13px] text-[var(--color-ink-3)]">· WO-1041</span>
        <span className="text-[13px] text-[var(--color-ink-3)]">
          · agent generated the message from the work order
        </span>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.35fr]">
        {/* LEFT — questions */}
        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
            Before sending
          </p>
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              selectedSlots={selectedSlots}
              onToggleSlot={toggleSlot}
              contactConfirmed={contactConfirmed}
              onConfirmContact={() => setContactConfirmed(true)}
              includePO={includePO}
              onSetPO={setIncludePO}
            />
          ))}
        </div>

        {/* RIGHT — live draft */}
        <div className="flex flex-col gap-3">
          {/* Provenance */}
          <p className="text-[12px] text-[var(--color-ink-3)]">
            Drafted from work order{" "}
            <span className="num font-medium text-[var(--color-ink-2)]">WO-1041</span> —
            recipient, job &amp; PO pulled from what the agent read.
          </p>

          {/* Draft card */}
          <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#f7f8fa] text-[var(--color-ink-2)]">
                  <Mail size={13} strokeWidth={1.75} />
                </span>
                <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
                  Outreach draft{" "}
                  <span className="font-normal text-[var(--color-ink-3)]">· live</span>
                </span>
              </div>
              <span className="rounded-[6px] bg-[#f7f8fa] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-3)]">
                {message.channel}
              </span>
            </div>

            {/* To / Subject */}
            <div className="flex flex-col gap-1.5 border-b border-[var(--color-hairline)] px-4 py-3 text-[13px]">
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-[var(--color-ink-3)]">To</span>
                <span className="num text-[var(--color-ink)]">{message.to}</span>
              </div>
              <div className="flex gap-3">
                <span className="w-14 shrink-0 text-[var(--color-ink-3)]">Subject</span>
                <span className="text-[var(--color-ink)]">{message.subject}</span>
              </div>
            </div>

            {/* Body */}
            <p className="whitespace-pre-line px-4 py-4 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
              {message.body}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
          >
            <ChevronLeft size={14} strokeWidth={2} />
            Back to Inbound
          </button>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-3">
          {sent ? (
            <span className="flex items-center gap-1.5 text-[13px] text-[#15803d]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ecfdf3]">
                <Check size={11} strokeWidth={3} className="text-[#15803d]" />
              </span>
              <span>
                <span className="num">Sent to {message.to}</span> — you committed the send
              </span>
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-3)]">
                <Shield size={12} strokeWidth={1.75} />
                Goes through ArmorIQ — you approve the send.
              </span>
              <ArmorIQGate action={{ type: "send-schedule" }} onAllow={handleSend}>
                {(check) => (
                  <button
                    type="button"
                    onClick={check}
                    disabled={approving || selectedSlots.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-3.5 h-9 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4fd1] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approving ? (
                      <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                    ) : null}
                    Send to client
                    {!approving ? <ChevronRight size={14} strokeWidth={2.25} /> : null}
                  </button>
                )}
              </ArmorIQGate>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
