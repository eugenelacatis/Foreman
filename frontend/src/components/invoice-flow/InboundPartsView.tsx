import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Truck,
} from "lucide-react";

/* ============================================================
   Types
   ============================================================ */
type DistanceOpt = 5 | 10 | 25 | 50;
type SortOpt = "cheapest" | "closest" | "fewest-stops" | "ready-soonest";
type AvailabilityOpt = "in-stock" | "pickup-ready" | "open-now" | "any";
type SupplierOpt = "all" | "my-accounts" | "preferred";
type CenterOn = "jobsite" | "me";
type Fulfillment = "pickup" | "ship";
type StrategyKey = "cheapest" | "fewest-stops";

interface PartNeed {
  id: string;
  name: string;
  qty: number;
}

interface Listing {
  supplierId: string;
  price: number;
  inStock: boolean;
  stockQty?: number;
  pickupReady: boolean;
  openNow: boolean;
}

interface Supplier {
  id: string;
  name: string;
  shortName: string;
  address: string;
  distanceMi: number;
  svgX: number;
  svgY: number;
  openNow: boolean;
  isMyAccount: boolean;
  isPreferred: boolean;
}

interface LocalPartsData {
  jobSite: { svgX: number; svgY: number };
  suppliers: Supplier[];
  listingsByPart: Record<string, Listing[]>;
}

interface OrderLine {
  partId: string;
  partName: string;
  qty: number;
  price: number;
}

interface StoreOrder {
  storeId: string;
  storeName: string;
  lines: OrderLine[];
  subtotal: number;
}

interface Strategy {
  total: number;
  stops: number;
  stores: StoreOrder[];
}

interface CheckoutResult {
  checkoutUrl: string;
  eta: string;
}

interface CheckoutState {
  loading: boolean;
  result: CheckoutResult | null;
}

/* ============================================================
   Anticipated parts
   In production: derive from wo.classification.entities (e.g. job_type → part list)
   ============================================================ */
const ANTICIPATED_PARTS: PartNeed[] = [
  { id: "cap", name: "Compressor capacitor", qty: 1 },
  { id: "con", name: "Contactor", qty: 1 },
  { id: "ref", name: "Refrigerant R-410A", qty: 2 },
];

/* ============================================================
   Mock data — swap this function body for the real endpoint:
   POST /api/parts/local { parts, location } → LocalPartsData
   ============================================================ */
function getLocalParts(_parts: PartNeed[], _location: string): LocalPartsData {
  return {
    jobSite: { svgX: 220, svgY: 130 },
    suppliers: [
      {
        id: "s1", name: "ARS Supply Co.", shortName: "ARS",
        address: "88 Industrial Dr", distanceMi: 0.8,
        svgX: 90, svgY: 66, openNow: true, isMyAccount: true, isPreferred: true,
      },
      {
        id: "s2", name: "Johnstone Supply", shortName: "Johnstone",
        address: "210 Commerce Blvd", distanceMi: 1.4,
        svgX: 346, svgY: 72, openNow: true, isMyAccount: true, isPreferred: false,
      },
      {
        id: "s3", name: "HVAC City", shortName: "HVAC City",
        address: "5 Depot St", distanceMi: 2.1,
        svgX: 314, svgY: 198, openNow: true, isMyAccount: false, isPreferred: false,
      },
      {
        id: "s4", name: "Arctic Air Parts", shortName: "Arctic Air",
        address: "800 Cold Spring Rd", distanceMi: 3.5,
        svgX: 66, svgY: 196, openNow: false, isMyAccount: false, isPreferred: true,
      },
    ],
    listingsByPart: {
      cap: [
        { supplierId: "s4", price: 27.00, inStock: true, stockQty: 4, pickupReady: false, openNow: false },
        { supplierId: "s1", price: 28.50, inStock: true, stockQty: 6, pickupReady: true, openNow: true },
        { supplierId: "s2", price: 31.00, inStock: true, stockQty: 12, pickupReady: true, openNow: true },
      ],
      con: [
        { supplierId: "s2", price: 18.50, inStock: true, stockQty: 8, pickupReady: true, openNow: true },
        { supplierId: "s3", price: 19.75, inStock: true, stockQty: 5, pickupReady: false, openNow: true },
        { supplierId: "s1", price: 21.00, inStock: true, stockQty: 3, pickupReady: true, openNow: true },
      ],
      ref: [
        { supplierId: "s4", price: 21.00, inStock: true, stockQty: 8, pickupReady: false, openNow: false },
        { supplierId: "s3", price: 22.50, inStock: true, stockQty: 10, pickupReady: false, openNow: true },
        { supplierId: "s2", price: 24.00, inStock: true, stockQty: 20, pickupReady: true, openNow: true },
      ],
    },
  };
}

/* ============================================================
   Mock checkout — swap this function body for the real endpoint:
   POST /api/checkout/prepare { storeId, parts, fulfillment } → CheckoutResult
   TODO: integrate Browserbase to open the supplier's live checkout session
   ============================================================ */
async function prepareCheckout(
  storeId: string,
  _lines: OrderLine[],
  fulfillment: Fulfillment,
): Promise<CheckoutResult> {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 300));
  return {
    // TODO: replace with real Browserbase checkout URL
    checkoutUrl: `https://checkout.example.com/?store=${storeId}&mode=${fulfillment}&t=${Date.now()}`,
    eta: fulfillment === "pickup" ? "Today, 3:30 PM" : "Jun 23, 2026",
  };
}

/* ============================================================
   Helpers
   ============================================================ */
const fmtMoney = (n: number) =>
  "$" +
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDist = (mi: number) => `${mi} mi`;

function applyFilters(
  listings: Listing[],
  suppliers: Supplier[],
  opts: {
    distance: DistanceOpt;
    availability: AvailabilityOpt;
    supplierFilter: SupplierOpt;
  },
): Listing[] {
  return listings.filter((l) => {
    const s = suppliers.find((sup) => sup.id === l.supplierId);
    if (!s) return false;
    if (s.distanceMi > opts.distance) return false;
    if (opts.availability === "in-stock" && !l.inStock) return false;
    if (opts.availability === "pickup-ready" && !l.pickupReady) return false;
    if (opts.availability === "open-now" && !s.openNow) return false;
    if (opts.supplierFilter === "my-accounts" && !s.isMyAccount) return false;
    if (opts.supplierFilter === "preferred" && !s.isPreferred) return false;
    return true;
  });
}

function sortListings(
  listings: Listing[],
  sort: SortOpt,
  suppliers: Supplier[],
): Listing[] {
  return [...listings].sort((a, b) => {
    if (sort === "closest") {
      const da = suppliers.find((s) => s.id === a.supplierId)?.distanceMi ?? 99;
      const db = suppliers.find((s) => s.id === b.supplierId)?.distanceMi ?? 99;
      return da - db;
    }
    // cheapest, fewest-stops, ready-soonest: primary sort by price
    return a.price - b.price;
  });
}

function computeStrategies(
  parts: PartNeed[],
  suppliers: Supplier[],
  listingsByPart: Record<string, Listing[]>,
): { cheapest: Strategy; fewestStops: Strategy } {
  // ── Cheapest combo: per part, pick the lowest-priced in-stock listing ──
  const cheapMap = new Map<string, StoreOrder>();
  let cheapTotal = 0;
  for (const part of parts) {
    const ls = (listingsByPart[part.id] ?? []).filter((l) => l.inStock);
    if (!ls.length) continue;
    const best = ls.reduce((a, b) => (a.price < b.price ? a : b));
    const sup = suppliers.find((s) => s.id === best.supplierId);
    if (!sup) continue;
    cheapTotal += best.price * part.qty;
    if (!cheapMap.has(best.supplierId)) {
      cheapMap.set(best.supplierId, {
        storeId: best.supplierId,
        storeName: sup.name,
        lines: [],
        subtotal: 0,
      });
    }
    const o = cheapMap.get(best.supplierId)!;
    o.lines.push({ partId: part.id, partName: part.name, qty: part.qty, price: best.price });
    o.subtotal += best.price * part.qty;
  }

  // ── Fewest stops: greedy set cover ──
  const remaining = new Map(parts.map((p) => [p.id, p]));
  const fewestStores: StoreOrder[] = [];
  let fewestTotal = 0;
  while (remaining.size > 0) {
    let bestSup: Supplier | null = null;
    let bestCov = 0;
    for (const s of suppliers) {
      const cov = [...remaining.keys()].filter((pid) =>
        (listingsByPart[pid] ?? []).some((l) => l.supplierId === s.id && l.inStock),
      ).length;
      if (cov > bestCov) {
        bestCov = cov;
        bestSup = s;
      }
    }
    if (!bestSup || bestCov === 0) break;
    const order: StoreOrder = {
      storeId: bestSup.id,
      storeName: bestSup.name,
      lines: [],
      subtotal: 0,
    };
    for (const [pid, part] of [...remaining]) {
      const listing = (listingsByPart[pid] ?? []).find(
        (l) => l.supplierId === bestSup!.id && l.inStock,
      );
      if (listing) {
        order.lines.push({
          partId: pid,
          partName: part.name,
          qty: part.qty,
          price: listing.price,
        });
        order.subtotal += listing.price * part.qty;
        fewestTotal += listing.price * part.qty;
        remaining.delete(pid);
      }
    }
    fewestStores.push(order);
  }

  return {
    cheapest: { total: cheapTotal, stops: cheapMap.size, stores: [...cheapMap.values()] },
    fewestStops: { total: fewestTotal, stops: fewestStores.length, stores: fewestStores },
  };
}

/* ============================================================
   Dropdown (click-to-open, outside-click-to-close)
   ============================================================ */
function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? String(value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[var(--color-hairline)] bg-white px-3 h-8 text-[12.5px] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink-3)]"
      >
        <span className="text-[var(--color-ink-3)]">{label}:</span>
        {selectedLabel}
        <ChevronDown size={12} strokeWidth={2.5} className="text-[var(--color-ink-3)]" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-20 min-w-[160px] overflow-hidden rounded-[8px] border border-[var(--color-hairline)] bg-white shadow-lg">
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={
                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-[#fafbfd] " +
                (o.value === value
                  ? "font-medium text-[var(--color-accent)]"
                  : "text-[var(--color-ink)]")
              }
            >
              {o.label}
              {o.value === value && (
                <Check
                  size={12}
                  strokeWidth={2.5}
                  className="shrink-0 text-[var(--color-accent)]"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SVG Map
   TODO: replace the SVG placeholder with a real tile layer
         (e.g. Mapbox GL JS or Leaflet) and keep the pin overlay
         as a React layer positioned on top.
   ============================================================ */
interface MapCanvasProps {
  jobSite: { svgX: number; svgY: number };
  suppliers: Supplier[];
  hoveredIds: Set<string>;
  planIds: Set<string>;
  selectedId: string | null;
  centerOn: CenterOn;
  onSelect: (id: string) => void;
}

function MapCanvas({
  jobSite,
  suppliers,
  hoveredIds,
  planIds,
  selectedId,
  centerOn,
  onSelect,
}: MapCanvasProps) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-[#eef1f5]">
      {/* TODO: mount tile layer here */}
      <svg viewBox="0 0 440 260" className="w-full" style={{ display: "block" }}>
        <rect width="440" height="260" fill="#eef1f5" />

        {/* Road grid */}
        <rect x="0" y="122" width="440" height="16" fill="#d8dce4" />
        <rect x="204" y="0" width="16" height="260" fill="#d8dce4" />
        <rect x="40" y="60" width="370" height="10" fill="#e1e5eb" />
        <rect x="30" y="188" width="380" height="10" fill="#e1e5eb" />
        <line x1="0" y1="130" x2="440" y2="130" stroke="#c4c9d4" strokeWidth="1" strokeDasharray="10 8" />
        <line x1="212" y1="0" x2="212" y2="260" stroke="#c4c9d4" strokeWidth="1" strokeDasharray="10 8" />

        {/* City blocks */}
        <rect x="36" y="70" width="162" height="46" fill="#e5e9ef" rx="3" />
        <rect x="224" y="70" width="206" height="46" fill="#e5e9ef" rx="3" />
        <rect x="36" y="140" width="162" height="42" fill="#e5e9ef" rx="3" />
        <rect x="224" y="140" width="206" height="42" fill="#e5e9ef" rx="3" />

        {/* Job-site pulse ring (active when centering on job site) */}
        {centerOn === "jobsite" && (
          <circle
            cx={jobSite.svgX}
            cy={jobSite.svgY}
            r="20"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            opacity="0.2"
          />
        )}

        {/* Supplier pins */}
        {suppliers.map((s) => {
          const isSelected = s.id === selectedId;
          const isHovered = hoveredIds.has(s.id);
          const isInPlan = planIds.has(s.id);
          const pillW = s.shortName.length * 7.4 + 28;
          const pillH = s.openNow ? 24 : 32;
          const stroke = isSelected || isHovered
            ? "#2563eb"
            : isInPlan
              ? "#93b4fd"
              : "#d5d9e2";
          return (
            <g
              key={s.id}
              transform={`translate(${s.svgX},${s.svgY})`}
              onClick={() => onSelect(s.id)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={-pillW / 2}
                y={-pillH / 2}
                width={pillW}
                height={pillH}
                rx="12"
                fill="white"
                stroke={stroke}
                strokeWidth={isSelected || isHovered ? 2 : 1.5}
              />
              <circle
                cx={-pillW / 2 + 11}
                cy={s.openNow ? 0 : -5}
                r={3.5}
                fill={isInPlan ? "#2563eb" : "#94a3b8"}
              />
              <text
                x={-pillW / 2 + 20}
                y={s.openNow ? 4.5 : -0.5}
                fontSize="10.5"
                fontFamily="system-ui,sans-serif"
                fontWeight={isInPlan ? "600" : "400"}
                fill={isInPlan ? "#16191f" : "#475569"}
              >
                {s.shortName}
              </text>
              {!s.openNow && (
                <text
                  x={-pillW / 2 + 20}
                  y="12"
                  fontSize="9"
                  fontFamily="system-ui,sans-serif"
                  fill="#94a3b8"
                >
                  closed
                </text>
              )}
            </g>
          );
        })}

        {/* Job-site pin */}
        <g transform={`translate(${jobSite.svgX},${jobSite.svgY})`}>
          <circle r="11" fill="#2563eb" opacity="0.15" />
          <circle r="8" fill="#2563eb" />
          <circle r="3.5" fill="white" />
          <text
            x="13"
            y="4"
            fontSize="10"
            fontFamily="system-ui,sans-serif"
            fontWeight="600"
            fill="#16191f"
          >
            Job site
          </text>
        </g>
      </svg>
    </div>
  );
}

/* ============================================================
   Part comparison card (one per anticipated part)
   ============================================================ */
interface PartCardProps {
  part: PartNeed;
  listings: Listing[];
  suppliers: Supplier[];
  planSupplierId: string | undefined;
  onHover: (id: string | null) => void;
}

function PartCard({
  part,
  listings,
  suppliers,
  planSupplierId,
  onHover,
}: PartCardProps) {
  const lowestPrice = listings
    .filter((l) => l.inStock)
    .reduce((min, l) => Math.min(min, l.price), Infinity);

  return (
    <div
      className="overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white"
      onMouseEnter={() => onHover(part.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Part header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium text-[var(--color-ink)]">
            {part.name}
          </span>
          <span className="num text-[12.5px] text-[var(--color-ink-3)]">×{part.qty}</span>
        </div>
        <span className="rounded-full bg-[var(--color-sent-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-sent-ink)]">
          expected
        </span>
      </div>

      {listings.length === 0 ? (
        <div className="px-4 py-3 text-[12.5px] text-[var(--color-ink-3)]">
          No suppliers match current filters.
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-hairline)]">
              {["Supplier", "Dist.", "Price", "Stock"].map((h, i) => (
                <th
                  key={h}
                  className={
                    "px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)] " +
                    (i === 0 ? "text-left" : "text-right")
                  }
                >
                  {h}
                </th>
              ))}
              {/* Best badge column */}
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => {
              const sup = suppliers.find((s) => s.id === l.supplierId);
              if (!sup) return null;
              const isBest = l.inStock && l.price === lowestPrice;
              const isInPlan = sup.id === planSupplierId;
              return (
                <tr
                  key={l.supplierId}
                  className={
                    "border-b border-[var(--color-hairline)] last:border-b-0 transition-colors " +
                    (isInPlan ? "bg-[var(--color-accent-tint)]" : "")
                  }
                >
                  <td className="px-3 py-2.5">
                    <div className="text-[13px] font-medium text-[var(--color-ink)]">
                      {sup.name}
                    </div>
                    {sup.isMyAccount && (
                      <div className="text-[11px] text-[var(--color-ink-3)]">
                        My account
                      </div>
                    )}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-[12.5px] text-[var(--color-ink-2)]">
                    {fmtDist(sup.distanceMi)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-[13px] font-medium text-[var(--color-ink)]">
                    {fmtMoney(l.price)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px]">
                    {l.inStock ? (
                      <span className="text-[var(--color-sent-ink)]">
                        {l.stockQty != null ? `${l.stockQty} avail.` : "In stock"}
                      </span>
                    ) : (
                      <span className="text-red-400">Out of stock</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    {isBest ? (
                      <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10.5px] font-semibold text-white">
                        Best
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ============================================================
   Summary strip — cheapest combo vs fewest stops picker
   ============================================================ */
interface SummaryStripProps {
  cheapest: Strategy;
  fewestStops: Strategy;
  activeStrategy: StrategyKey;
  onSelect: (k: StrategyKey) => void;
}

function SummaryStrip({
  cheapest,
  fewestStops,
  activeStrategy,
  onSelect,
}: SummaryStripProps) {
  const opts: { key: StrategyKey; label: string; strategy: Strategy }[] = [
    { key: "cheapest", label: "Cheapest combo", strategy: cheapest },
    { key: "fewest-stops", label: "Fewest stops", strategy: fewestStops },
  ];

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white">
      <div className="border-b border-[var(--color-hairline)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
        Pick your approach
      </div>
      <div className="grid grid-cols-2 divide-x divide-[var(--color-hairline)]">
        {opts.map(({ key, label, strategy }) => {
          const active = activeStrategy === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={
                "flex flex-col gap-1 px-4 py-3 text-left transition-colors " +
                (active ? "bg-[var(--color-accent-tint)]" : "hover:bg-[#fafbfd]")
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition-colors " +
                    (active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                      : "border-[var(--color-hairline)] bg-white")
                  }
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span
                  className={
                    "text-[12.5px] font-medium " +
                    (active ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]")
                  }
                >
                  {label}
                </span>
              </div>
              <div className="pl-6">
                <span className="num text-[14px] font-semibold text-[var(--color-ink)]">
                  {fmtMoney(strategy.total)}
                </span>
                <span className="ml-1.5 text-[12px] text-[var(--color-ink-3)]">
                  across {strategy.stops}{" "}
                  {strategy.stops === 1 ? "stop" : "stops"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Order section — Pickup / Ship toggle + per-store checkout
   ============================================================ */
interface OrderSectionProps {
  strategy: Strategy;
  fulfillment: Fulfillment;
  onFulfillmentChange: (f: Fulfillment) => void;
  checkoutStates: Record<string, CheckoutState>;
  onCheckout: (store: StoreOrder) => void;
}

function OrderSection({
  strategy,
  fulfillment,
  onFulfillmentChange,
  checkoutStates,
  onCheckout,
}: OrderSectionProps) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white">
      {/* Fulfillment toggle */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] px-4 py-3">
        <span className="text-[13px] font-medium text-[var(--color-ink)]">Order</span>
        <div className="flex items-center rounded-[8px] border border-[var(--color-hairline)] bg-[#fafbfd] p-0.5">
          {(["pickup", "ship"] as Fulfillment[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFulfillmentChange(f)}
              className={
                "inline-flex items-center gap-1.5 rounded-[6px] px-3 h-7 text-[12.5px] font-medium capitalize transition-colors " +
                (fulfillment === f
                  ? "bg-white text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]")
              }
            >
              {f === "pickup" ? (
                <Package size={12} strokeWidth={2} />
              ) : (
                <Truck size={12} strokeWidth={2} />
              )}
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Per-store rows — one checkout link per store */}
      <div className="divide-y divide-[var(--color-hairline)]">
        {strategy.stores.map((store) => {
          const cs = checkoutStates[store.storeId];
          return (
            <div key={store.storeId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--color-ink)]">
                    {store.storeName}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-[var(--color-ink-2)]">
                    {store.lines
                      .map((l) => `${l.partName}${l.qty > 1 ? ` ×${l.qty}` : ""}`)
                      .join(" · ")}
                  </div>
                  <div className="num mt-0.5 text-[12.5px] font-medium text-[var(--color-ink)]">
                    {fmtMoney(store.subtotal)}
                  </div>
                  {cs?.result && (
                    <div className="mt-1 text-[11.5px] text-[var(--color-ink-3)]">
                      <span className="text-[var(--color-sent-ink)]">✓</span>{" "}
                      {fulfillment === "pickup" ? "Pickup ETA" : "Delivery"}:{" "}
                      <span className="text-[var(--color-ink)]">{cs.result.eta}</span>
                    </div>
                  )}
                </div>

                {/* One checkout button per store — opens URL in new tab; stops at checkout */}
                <button
                  type="button"
                  disabled={cs?.loading}
                  onClick={() => {
                    if (cs?.result) {
                      window.open(cs.result.checkoutUrl, "_blank", "noopener,noreferrer");
                    } else {
                      onCheckout(store);
                    }
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-3 h-8 text-[12.5px] font-medium text-white transition-colors hover:bg-[#1d4fd1] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {cs?.loading ? (
                    <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                  ) : cs?.result ? (
                    <>
                      <ExternalLink size={12} strokeWidth={2} />
                      Open checkout
                    </>
                  ) : (
                    "Review & check out"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Main component
   ============================================================ */
export default function InboundPartsView() {
  // Filter state
  const [distance, setDistance] = useState<DistanceOpt>(25);
  const [sort, setSort] = useState<SortOpt>("cheapest");
  const [availability, setAvailability] = useState<AvailabilityOpt>("any");
  const [supplierFilter, setSupplierFilter] = useState<SupplierOpt>("all");
  const [centerOn, setCenterOn] = useState<CenterOn>("jobsite");

  // UI interaction state
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // Order state
  const [activeStrategy, setActiveStrategy] = useState<StrategyKey>("cheapest");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [checkoutStates, setCheckoutStates] = useState<Record<string, CheckoutState>>({});

  // Data (stable — getLocalParts is pure mock)
  const { jobSite, suppliers, listingsByPart } = useMemo(
    () => getLocalParts(ANTICIPATED_PARTS, "412 Cedar Court"),
    [],
  );

  // Apply filters + sort to listings per part
  const filteredListings = useMemo(() => {
    const result: Record<string, Listing[]> = {};
    for (const part of ANTICIPATED_PARTS) {
      const raw = listingsByPart[part.id] ?? [];
      const filtered = applyFilters(raw, suppliers, { distance, availability, supplierFilter });
      result[part.id] = sortListings(filtered, sort, suppliers);
    }
    return result;
  }, [listingsByPart, suppliers, distance, sort, availability, supplierFilter]);

  // Compute both strategies from filtered listings
  const { cheapest, fewestStops } = useMemo(
    () => computeStrategies(ANTICIPATED_PARTS, suppliers, filteredListings),
    [suppliers, filteredListings],
  );

  const activeStrategyData = activeStrategy === "cheapest" ? cheapest : fewestStops;

  // Which supplier has the active plan's listing for each part
  const planSupplierByPart = useMemo(() => {
    const result: Record<string, string> = {};
    for (const store of activeStrategyData.stores) {
      for (const line of store.lines) {
        result[line.partId] = store.storeId;
      }
    }
    return result;
  }, [activeStrategyData]);

  // Suppliers that carry the hovered part → highlight on map
  const hoveredIds = useMemo(() => {
    if (!hoveredPartId) return new Set<string>();
    return new Set(
      (filteredListings[hoveredPartId] ?? []).map((l) => l.supplierId),
    );
  }, [hoveredPartId, filteredListings]);

  // Suppliers in the active order plan → highlight on map
  const planIds = useMemo(
    () => new Set(activeStrategyData.stores.map((s) => s.storeId)),
    [activeStrategyData],
  );

  // Reset checkout states when strategy or fulfillment changes
  useEffect(() => {
    setCheckoutStates({});
  }, [activeStrategy, fulfillment]);

  const handleCheckout = useCallback(
    async (store: StoreOrder) => {
      setCheckoutStates((prev) => ({
        ...prev,
        [store.storeId]: { loading: true, result: null },
      }));
      try {
        const result = await prepareCheckout(store.storeId, store.lines, fulfillment);
        setCheckoutStates((prev) => ({
          ...prev,
          [store.storeId]: { loading: false, result },
        }));
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      } catch {
        setCheckoutStates((prev) => ({
          ...prev,
          [store.storeId]: { loading: false, result: null },
        }));
      }
    },
    [fulfillment],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Section header + filters row ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">
          Anticipated parts
        </span>
        <span className="text-[var(--color-ink-3)]">·</span>
        <Dropdown<DistanceOpt>
          label="Distance"
          value={distance}
          options={[
            { value: 5, label: "5 mi" },
            { value: 10, label: "10 mi" },
            { value: 25, label: "25 mi" },
            { value: 50, label: "50 mi" },
          ]}
          onChange={setDistance}
        />
        <Dropdown<SortOpt>
          label="Sort"
          value={sort}
          options={[
            { value: "cheapest", label: "Cheapest" },
            { value: "closest", label: "Closest" },
            { value: "fewest-stops", label: "Fewest stops" },
            { value: "ready-soonest", label: "Ready soonest" },
          ]}
          onChange={setSort}
        />
        <Dropdown<AvailabilityOpt>
          label="Availability"
          value={availability}
          options={[
            { value: "any", label: "Any" },
            { value: "in-stock", label: "In stock" },
            { value: "pickup-ready", label: "Pickup ready" },
            { value: "open-now", label: "Open now" },
          ]}
          onChange={setAvailability}
        />
        <Dropdown<SupplierOpt>
          label="Suppliers"
          value={supplierFilter}
          options={[
            { value: "all", label: "All" },
            { value: "my-accounts", label: "My accounts" },
            { value: "preferred", label: "Preferred" },
          ]}
          onChange={setSupplierFilter}
        />
      </div>

      {/* ── Main 2-column grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Left column: part cards + summary strip */}
        <div className="flex flex-col gap-3">
          {ANTICIPATED_PARTS.map((part) => (
            <PartCard
              key={part.id}
              part={part}
              listings={filteredListings[part.id] ?? []}
              suppliers={suppliers}
              planSupplierId={planSupplierByPart[part.id]}
              onHover={setHoveredPartId}
            />
          ))}
          <SummaryStrip
            cheapest={cheapest}
            fewestStops={fewestStops}
            activeStrategy={activeStrategy}
            onSelect={setActiveStrategy}
          />
        </div>

        {/* Right column: map + controls + order section */}
        <div className="flex flex-col gap-3">
          <MapCanvas
            jobSite={jobSite}
            suppliers={suppliers}
            hoveredIds={hoveredIds}
            planIds={planIds}
            selectedId={selectedSupplierId}
            centerOn={centerOn}
            onSelect={setSelectedSupplierId}
          />

          {/* Map controls row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-3)]">
              <MapPin size={13} strokeWidth={2} className="text-[var(--color-accent)]" />
              Shop near
            </div>
            <div className="flex items-center rounded-[8px] border border-[var(--color-hairline)] p-0.5">
              {(["jobsite", "me"] as CenterOn[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCenterOn(opt)}
                  className={
                    "rounded-[6px] px-3 h-7 text-[12.5px] font-medium transition-colors " +
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
              {suppliers.length} nearby
            </span>
          </div>

          <OrderSection
            strategy={activeStrategyData}
            fulfillment={fulfillment}
            onFulfillmentChange={setFulfillment}
            checkoutStates={checkoutStates}
            onCheckout={handleCheckout}
          />
        </div>
      </div>
    </div>
  );
}
