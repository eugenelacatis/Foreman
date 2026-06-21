import type { ReactNode } from "react";
import { Mic } from "lucide-react";
import SectionHeading from "./SectionHeading";

type ButtonVariant = "solid" | "outline";

interface Item {
  id: string;
  client: string;
  tag?: string;
  note: string;
  cta: { label: string; variant: ButtonVariant };
}

const items: Item[] = [
  {
    id: "maplewood",
    client: "Maplewood HVAC",
    note: "Invoice ready — approve to finish",
    cta: { label: "Approve", variant: "solid" },
  },
  {
    id: "delgado",
    client: "Delgado Electric",
    tag: "voice note",
    note: "New from the field — take a look",
    cta: { label: "View", variant: "outline" },
  },
];

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent-tint)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-accent)]">
      <Mic size={10} strokeWidth={2.25} />
      {children}
    </span>
  );
}

function Button({
  variant,
  onClick,
  children,
}: {
  variant: ButtonVariant;
  onClick?: () => void;
  children: ReactNode;
}) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-3 h-8 text-[13px] font-medium transition-colors'
  if (variant === 'solid') {
    return (
      <button type="button" onClick={onClick} className={`${base} bg-[var(--color-accent)] text-white hover:bg-[#1d4fd1]`}>
        {children}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[#f7f8fa]`}
    >
      {children}
    </button>
  )
}

interface NeedsYouProps {
  onApprove?: (id: string) => void;
  onView?: (id: string) => void;
}

export default function NeedsYou({ onApprove, onView }: NeedsYouProps) {
  return (
    <section>
      <SectionHeading title="Current tasks" badge={items.length} />
      <div className="overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white">
        {items.map((item, i) => (
          <div
            key={item.id}
            className={
              'flex items-center gap-4 px-4 sm:px-5 py-4 ' +
              (i > 0 ? 'border-t border-[var(--color-hairline)]' : '')
            }
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium text-[var(--color-ink)]">
                  {item.client}
                </span>
                {item.tag ? <Tag>{item.tag}</Tag> : null}
              </div>
              <p className="mt-0.5 text-[13px] text-[var(--color-ink-2)]">{item.note}</p>
            </div>
            <Button
              variant={item.cta.variant}
              onClick={() =>
                item.cta.label === "Approve"
                  ? onApprove?.(item.id)
                  : onView?.(item.id)
              }
            >
              {item.cta.label}
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
