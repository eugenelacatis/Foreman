import type { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  badge?: number;
  right?: ReactNode;
}

export default function SectionHeading({
  title,
  badge,
  right,
}: SectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="font-display text-[16px] font-semibold tracking-tight text-[var(--color-ink)]">
        {title}
      </h2>
      {badge != null ? (
        <span className="num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[11px] font-medium leading-none text-white">
          {badge}
        </span>
      ) : null}
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}
