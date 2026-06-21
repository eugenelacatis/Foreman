import { useState } from "react";
import { MapPin, Package, Check, X } from "lucide-react";

/* ============================================================
   Data types
   ============================================================ */
interface PartQuery {
  id: string;
  name: string;
  qty: number | string;
}

interface SupplierPart {
  name: string;
  price: number;
  inStock: boolean;
  stockQty?: number;
}

interface Supplier {
  id: string;
  name: string;
  shortName: string;
  address: string;
  distance: string;
  svgX: number;
  svgY: number;
  parts: SupplierPart[];
}

interface LocalPartsResult {
  jobSite: { svgX: number; svgY: number; address: string };
  suppliers: Supplier[];
  partTags: Record<string, "expected" | "added on site">;
}

/* ============================================================
   Mock data — swap the body of this function for the real endpoint.
   Signature: (parts: PartQuery[], location: string) => LocalPartsResult
   TODO: replace with fetch('/api/parts/local', { method:'POST', body: JSON.stringify({ parts, location }) })
   ============================================================ */
function getLocalParts(_parts: PartQuery[], _location: string): LocalPartsResult {
  return {
    jobSite: { svgX: 220, svgY: 138, address: "412 Cedar Court, Unit 2B" },
    suppliers: [
      {
        id: "s1",
        name: "ARS Supply Co.",
        shortName: "ARS",
        address: "88 Industrial Dr",
        distance: "0.8 mi",
        svgX: 88,
        svgY: 64,
        parts: [
          { name: "Compressor capacitor", price: 28.5, inStock: true, stockQty: 6 },
          { name: "Contactor", price: 21.0, inStock: true, stockQty: 3 },
        ],
      },
      {
        id: "s2",
        name: "Johnstone Supply",
        shortName: "Johnstone",
        address: "210 Commerce Blvd",
        distance: "1.4 mi",
        svgX: 346,
        svgY: 72,
        parts: [
          { name: "Compressor capacitor", price: 31.0, inStock: true, stockQty: 12 },
          { name: "Contactor", price: 18.5, inStock: false },
        ],
      },
      {
        id: "s3",
        name: "HVAC City",
        shortName: "HVAC City",
        address: "5 Depot St",
        distance: "2.1 mi",
        svgX: 308,
        svgY: 206,
        parts: [{ name: "Contactor", price: 19.75, inStock: true, stockQty: 8 }],
      },
    ],
    partTags: {
      "Compressor capacitor — replace": "expected",
      "Contactor — replace": "expected",
      "Labor · diagnose & repair": "added on site",
    },
  };
}

/* ============================================================
   Helpers
   ============================================================ */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*[—–-]\s*(replace|repair|install|swap|diagnose.*)$/i, "")
    .trim();
}

function supplierHasPart(supplier: Supplier, lineName: string): boolean {
  const needle = normalizeName(lineName);
  return supplier.parts.some((p) => p.name.toLowerCase().includes(needle.split(" ")[0]));
}

const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ============================================================
   SVG Map
   ============================================================ */
interface MapProps {
  jobSite: LocalPartsResult["jobSite"];
  suppliers: Supplier[];
  selectedId: string;
  highlightedIds: string[];
  onSelectSupplier: (id: string) => void;
  centerOn: "jobsite" | "me";
}

function MapCanvas({
  jobSite,
  suppliers,
  selectedId,
  highlightedIds,
  onSelectSupplier,
  centerOn,
}: MapProps) {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-[#eef1f5]">
      {/* TODO: Replace this SVG placeholder with a real tile layer (e.g. Mapbox GL or Leaflet).
               Mount it here, keep the pin overlay as a React layer on top. */}
      <svg
        viewBox="0 0 440 260"
        className="w-full"
        style={{ display: "block" }}
        aria-label="Local parts map"
      >
        {/* Background */}
        <rect width="440" height="260" fill="#eef1f5" />

        {/* Road grid */}
        {/* Horizontal main road */}
        <rect x="0" y="124" width="440" height="14" fill="#d8dce4" rx="0" />
        {/* Vertical main road */}
        <rect x="206" y="0" width="14" height="260" fill="#d8dce4" />
        {/* Secondary H road (upper) */}
        <rect x="40" y="58" width="370" height="10" fill="#e2e5eb" />
        {/* Secondary H road (lower) */}
        <rect x="30" y="196" width="380" height="10" fill="#e2e5eb" />
        {/* Road center lines */}
        <line
          x1="0" y1="131" x2="440" y2="131"
          stroke="#c8cdd6" strokeWidth="1" strokeDasharray="12 8"
        />
        <line
          x1="213" y1="0" x2="213" y2="260"
          stroke="#c8cdd6" strokeWidth="1" strokeDasharray="12 8"
        />

        {/* Block fills */}
        <rect x="30" y="68" width="170" height="50" fill="#e6e9ef" rx="4" />
        <rect x="224" y="68" width="206" height="50" fill="#e6e9ef" rx="4" />
        <rect x="30" y="142" width="170" height="48" fill="#e6e9ef" rx="4" />
        <rect x="224" y="142" width="206" height="48" fill="#e6e9ef" rx="4" />

        {/* Job-site pulse ring (only when centering on job site) */}
        {centerOn === "jobsite" && (
          <circle
            cx={jobSite.svgX}
            cy={jobSite.svgY}
            r="22"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            opacity="0.25"
          />
        )}

        {/* Supplier pins */}
        {suppliers.map((s) => {
          const isSelected = s.id === selectedId;
          const isHighlighted = highlightedIds.includes(s.id);
          const pillW = s.shortName.length * 7 + 28;
          const pillH = 26;
          return (
            <g
              key={s.id}
              transform={`translate(${s.svgX}, ${s.svgY})`}
              onClick={() => onSelectSupplier(s.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Pill */}
              <rect
                x={-pillW / 2}
                y={-pillH / 2}
                width={pillW}
                height={pillH}
                rx="13"
                fill="white"
                stroke={isSelected ? "#2563eb" : isHighlighted ? "#93b4fd" : "#d5d9e2"}
                strokeWidth={isSelected ? 2 : 1.5}
                filter={isSelected ? "url(#shadow)" : undefined}
              />
              {/* Dot */}
              <circle
                cx={-pillW / 2 + 11}
                cy={0}
                r={4}
                fill={isSelected ? "#2563eb" : "#94a3b8"}
              />
              {/* Label */}
              <text
                x={-pillW / 2 + 20}
                y={4.5}
                fontSize="11"
                fontFamily="system-ui, sans-serif"
                fontWeight={isSelected ? "600" : "400"}
                fill={isSelected ? "#16191f" : "#475569"}
              >
                {s.shortName}
              </text>
            </g>
          );
        })}

        {/* Job-site pin */}
        <g transform={`translate(${jobSite.svgX}, ${jobSite.svgY})`}>
          <circle r="13" fill="#2563eb" opacity="0.15" />
          <circle r="9" fill="#2563eb" />
          <circle r="4" fill="white" />
          <text
            x="14"
            y="4"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
            fill="#16191f"
          >
            Job site
          </text>
        </g>

        {/* Drop-shadow filter */}
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.12" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

/* ============================================================
   Supplier card
   ============================================================ */
function SupplierCard({ supplier }: { supplier: Supplier }) {
  const [reserved, setReserved] = useState(false);

  return (
    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--color-hairline)] px-4 py-3">
        <div>
          <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
            {supplier.name}
          </div>
          <div className="mt-0.5 text-[12px] text-[var(--color-ink-3)]">
            {supplier.address}
          </div>
        </div>
        <span className="num shrink-0 rounded-[6px] bg-[var(--color-accent-tint)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--color-accent)]">
          {supplier.distance}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-hairline)]">
            {["Part", "Price", "Stock"].map((h, i) => (
              <th
                key={h}
                className={
                  "px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)] " +
                  (i === 0 ? "text-left" : "text-right")
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {supplier.parts.map((p) => (
            <tr
              key={p.name}
              className="border-b border-[var(--color-hairline)] last:border-b-0"
            >
              <td className="px-4 py-2.5 text-[13px] text-[var(--color-ink)]">{p.name}</td>
              <td className="num px-4 py-2.5 text-right text-[13px] text-[var(--color-ink)]">
                {fmtMoney(p.price)}
              </td>
              <td className="px-4 py-2.5 text-right">
                {p.inStock ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-sent-ink)]">
                    <Check size={11} strokeWidth={2.5} />
                    {p.stockQty != null ? `${p.stockQty} avail.` : "In stock"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[12px] text-red-500">
                    <X size={11} strokeWidth={2.5} />
                    Out of stock
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-4 py-3">
        <button
          type="button"
          disabled={reserved}
          onClick={() => setReserved(true)}
          className={
            "inline-flex items-center gap-1.5 rounded-[8px] px-3.5 h-9 text-[13px] font-medium transition-colors " +
            (reserved
              ? "bg-[var(--color-sent-tint)] text-[var(--color-sent-ink)] cursor-default"
              : "bg-[var(--color-accent)] text-white hover:bg-[#1d4fd1]")
          }
        >
          {reserved ? (
            <>
              <Check size={13} strokeWidth={2.5} />
              Reserved for pickup
            </>
          ) : (
            <>
              <Package size={13} strokeWidth={2} />
              Reserve for pickup
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Main component
   ============================================================ */
interface PricingLine {
  id: string;
  item: string;
  qty: number | string;
  rate: number | string;
}

interface PricingViewProps {
  lines: PricingLine[];
}

const TAG_STYLES = {
  expected:
    "bg-[var(--color-sent-tint)] text-[var(--color-sent-ink)]",
  "added on site":
    "bg-amber-50 text-amber-700",
} as const;

export default function PricingView({ lines }: PricingViewProps) {
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("s1");
  const [centerOn, setCenterOn] = useState<"jobsite" | "me">("jobsite");

  const parts: PartQuery[] = lines.map((l) => ({
    id: l.id,
    name: l.item,
    qty: l.qty,
  }));

  const { jobSite, suppliers, partTags } = getLocalParts(parts, "412 Cedar Court");

  const selectedSupplier =
    suppliers.find((s) => s.id === selectedSupplierId) ?? suppliers[0];

  const highlightedSupplierIds = hoveredLineId
    ? suppliers
        .filter((s) => {
          const line = lines.find((l) => l.id === hoveredLineId);
          return line ? supplierHasPart(s, line.item) : false;
        })
        .map((s) => s.id)
    : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]">
      {/* ── Left: invoice lines with part tags ── */}
      <div className="flex flex-col gap-3">
        <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white">
          <div className="border-b border-[var(--color-hairline)] px-4 py-3 text-[13px] font-medium text-[var(--color-ink)]">
            Parts on this invoice
          </div>
          <ul>
            {lines.map((l) => {
              const tag = partTags[l.item];
              const hovered = hoveredLineId === l.id;
              return (
                <li
                  key={l.id}
                  onMouseEnter={() => setHoveredLineId(l.id)}
                  onMouseLeave={() => setHoveredLineId(null)}
                  className={
                    "flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] px-4 py-3 transition-colors last:border-b-0 " +
                    (hovered ? "bg-[var(--color-accent-tint)]" : "")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                      {l.item}
                    </div>
                    <div className="num mt-0.5 text-[12px] text-[var(--color-ink-3)]">
                      Qty {String(l.qty)}
                    </div>
                  </div>
                  {tag ? (
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                        TAG_STYLES[tag]
                      }
                    >
                      {tag}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-[11.5px] text-[var(--color-ink-3)]">
          Hover a line to highlight suppliers that carry the part.
        </p>
      </div>

      {/* ── Right: map + controls + supplier card ── */}
      <div className="flex flex-col gap-3">
        <MapCanvas
          jobSite={jobSite}
          suppliers={suppliers}
          selectedId={selectedSupplierId}
          highlightedIds={highlightedSupplierIds}
          onSelectSupplier={setSelectedSupplierId}
          centerOn={centerOn}
        />

        {/* Map controls row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-3)]">
            <MapPin size={13} strokeWidth={2} className="text-[var(--color-accent)]" />
            Shop near
          </div>
          <div className="flex items-center rounded-[8px] border border-[var(--color-hairline)] p-0.5">
            {(["jobsite", "me"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setCenterOn(opt)}
                className={
                  "rounded-[6px] px-3 py-1 text-[12.5px] font-medium transition-colors " +
                  (centerOn === opt
                    ? "bg-white text-[var(--color-ink)] shadow-sm"
                    : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]")
                }
              >
                {opt === "jobsite" ? "Job site" : "Me"}
              </button>
            ))}
          </div>
          <span className="text-[11.5px] text-[var(--color-ink-3)]">
            {suppliers.length} suppliers nearby
          </span>
        </div>

        <SupplierCard supplier={selectedSupplier} />
      </div>
    </div>
  );
}
