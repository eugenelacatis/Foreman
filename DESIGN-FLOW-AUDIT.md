# Design + Flow Audit — michelle/frontend-integration
Generated: 2026-06-21 | Branch: michelle/frontend-integration | Read-only.

---

## DESIGN SCORECARD

Tokens under test: `bg-white` surfaces · ink `#16191f` / ink2 `#5b6573` / ink3 `#9aa3af`
· hairline `#edeff3` · accent `#2563eb` / tint `#eef3ff` · success `#15803d` / `#ecfdf3`
· guardrail amber `#b45309` / `#fff7ed` · guardrail red `#b91c1c` / `#fef3f2`

Rules: no shadows · no gradients · hairline borders · `class="num"` on money/IDs/dates
· lucide-react icons only · card `rounded-[10px]` / modal `rounded-[12px]` · primary =
`bg-[var(--color-accent)] text-white` · secondary = `border border-[var(--color-hairline)] bg-white`

### In-flow components (actually rendered on golden path)

| Component | Result | Issues |
|---|---|---|
| `App.tsx` | PASS | — |
| `Sidebar.tsx` | PASS | — |
| `DropZone.tsx` | PASS | — |
| `NeedsYou.tsx` | FAIL | 2 radius issues — see below |
| `SearchBar.tsx` | PASS | — |
| `WorkOrders.tsx` | PASS | — |
| `Clients.tsx` | PASS | — |
| `WorkOrderToInvoiceFlow.tsx` | FAIL | 1 shadow on tab pill |
| `ScheduleStep.tsx` | PASS | — |
| `ArmorIQGate.tsx` | PASS | — |
| `InboundPartsView.tsx` | FAIL | 2 shadows (dropdown + tab pill) |
| `BrandedInvoice.tsx` | PASS | — |
| `PricingView.tsx` | FAIL | 1 shadow on tab pill + SVG filter |

### Out-of-flow components (exist on disk, not rendered on this branch)

`ArmorIQBlock.tsx`, `IntakeView.tsx`, `SchedulingView.tsx`, `WorkOrderPipeline.tsx` are
present on disk (pulled from main) but **not imported anywhere in the App→flow tree**.
They are all heavily off-design-system (Tailwind semantic colors, `rounded-xl`, `shadow-2xl`,
`bg-gray-*`, `bg-blue-600`). Not audited further — they are dead code on this branch.

### Design issues detail

```
[LOW]  NeedsYou.tsx:33    rounded-md on badge — should be rounded-[6px]
[LOW]  NeedsYou.tsx:48    rounded-lg on Button base class — should be rounded-[8px]
[LOW]  WorkOrderToInvoiceFlow.tsx:576   shadow-sm on active Document/Edit/Pricing tab pill
                           Fix: replace "shadow-sm" with "border border-[var(--color-hairline)]"
[LOW]  InboundPartsView.tsx:327   shadow-lg on filter dropdown
                           Fix: replace "shadow-lg" with "border border-[var(--color-hairline)]"
[LOW]  InboundPartsView.tsx:726   shadow-sm on Map/List tab pill (same pattern as :576)
[LOW]  InboundPartsView.tsx:1002  shadow-sm on fulfillment tab pill
[LOW]  PricingView.tsx:473        shadow-sm on sort/filter tab pill
[LOW]  PricingView.tsx:244-246    SVG <filter id="shadow"> on map pin glyph — intentional,
                           acceptable (SVG filter, not Tailwind shadow utility)
```

**Root cause of all tab shadows:** every tab-pill toggle in three separate files uses the same
pattern `"… shadow-sm"` for the active state. A shared `TabPill` primitive would fix all five
at once.

**Positive notes:**
- `class="num"` applied consistently on every money amount, ID, and date across all
  in-flow components. Zero naked numerals found in JSX text.
- Zero gradients, zero glassmorphism across all in-flow files.
- All icons are lucide-react. No emoji, no inline SVG icons, no other icon lib.
- Guardrail amber + red tokens applied correctly and only in `ArmorIQGate.tsx`.
- Success green (`#15803d` / `#ecfdf3`) used consistently for sent/confirmed states.

---

## FLOW SCORECARD

### Golden path — transition-by-transition

| # | Transition | Wired? | Notes |
|---|---|---|---|
| 1 | Dashboard DropZone → flow (step inbound) | ✓ | `startFlowWithFile` → `createWorkOrder` → `setWorkOrderId` → `setView("invoice-flow")` |
| 2 | Step 1 inbound → Approve & continue → step schedule | ✓ | `advance("intake", "schedule")` calls `approveStage`; falls back silently if backend down |
| 3 | Step 2 schedule → questions → ArmorIQ gate (allow) → step postjob | ✓ | `ArmorIQGate action="send-schedule"` → `checkAction` returns allow → `handleSend()` → `advance("scheduling","postjob")` after 1500ms |
| 4 | Step 3 postjob → See the invoice → step invoice | ✓ | Direct `setStep("invoice")` after reasoning animation |
| 5 | Step 4 invoice → Approve invoice → step approved | ✓ | `advance("invoice", "approved")` → `approveStage` |
| 6 | Step 5 approved → ArmorIQ gate (BLOCK) → resolve → sent | ✓ | `ArmorIQGate action="send-invoice"` → `checkAction` returns block → modal → "Send to verified contact" → `setSent(true)` after 2000ms resolve |
| 7 | Step 5 → Run again → resets to step inbound | ✓ | `onReset` callback clears state via parent |

**Golden path is end-to-end connected.**

### Back navigation

| Location | Back button | Wired? |
|---|---|---|
| Step 1 Inbound | (none — first step) | n/a |
| Step 2 Schedule | "← Back to Inbound" | ✓ `onBack={() => setStep("inbound")}` |
| Step 3 PostJob | "← Back to Schedule" | ✓ `onBack={() => setStep("schedule")}` |
| Step 4 Invoice | "← Back" | ✓ `onStepBack={() => setStep("postjob")}` |
| Step 5 Approved | "← Back to dashboard" | ✓ `onBack` prop → `backToDashboard()` |
| StageStepper | Completed stages as clickable buttons | ✓ `onStageJump(s.steps[0])` → `setStep()` |

Back nav is complete. No lock on step 5 — after approval, StageStepper still lets the user
jump back to earlier stages. This is intentional ("you send it, you're in control") but
could allow re-approving without a new work order. Acceptable for the demo.

### Dashboard entry points

| Entry | Component | Prop wired in App.tsx? | Result |
|---|---|---|---|
| Drop file | DropZone | ✓ `onFile={startFlowWithFile}` | Works — creates WO, opens flow |
| Search result | SearchBar | ✗ no `onSelect` prop passed | **Dead — click does nothing** |
| NeedsYou Approve | NeedsYou | ✗ no `onApprove` prop passed | **Dead — button does nothing** |
| NeedsYou View | NeedsYou | ✗ no `onView` prop passed | **Dead — button does nothing** |
| View order row | WorkOrders | ⚠ `onViewOrder={() => setView("invoice-flow")}` | Partial — transitions to flow but `workOrderId` = null (mock mode, no polling) |

**NeedsYou and SearchBar are completely non-functional as entry points.** The callbacks
exist in the components (NeedsYou accepts `onApprove?`/`onView?`, SearchBar exports
`SearchResult` and accepts `onSelect?`) but App.tsx passes nothing.

### Seam inventory

| Seam | File | Defined? | Called? |
|---|---|---|---|
| `composeOutreach(wo, opts)` | `ScheduleStep.tsx:32` | ✓ | ✓ at :297 — fed `wo`, `selectedSlotLabels`, `includePO` |
| `getScheduleQuestions(wo)` | `ScheduleStep.tsx:88` | ✓ | ✓ at :269 — re-runs when `wo` changes |
| `checkAction(action)` | `ArmorIQGate.tsx:44` | ✓ | ✓ `send-schedule` (ScheduleStep) + `send-invoice` (Step5Approved) |
| `getLocalParts(parts, loc)` | `InboundPartsView.tsx:101` | ✓ | ✓ at :824 — `useMemo`, pure mock |
| `prepareCheckout(storeId, lines, fulfillment)` | `InboundPartsView.tsx:151` | ✓ | ✓ at :884 in `handleCheckout()` — async, mock 600ms delay |
| `transcribe` | (VoiceIntake — not on branch) | n/a | n/a |
| `parseWorkOrder` | (backend/polling — not a frontend seam) | n/a | n/a |

All five frontend seams exist and are called in the right place. Each has a mock
implementation and a clear swap comment.

### Data threads

| Data | Source | Used in | Hardcoded fallback |
|---|---|---|---|
| `wo.classification.entities` | polling | `composeOutreach`, `getScheduleQuestions` | ✓ seeded WO-1041 values |
| `wo.schedule.proposed_times` | backend | `getScheduleQuestions` slot options | ✓ Jun 24/25/26 slots |
| `wo.invoice.line_items` | backend | `Step4Invoice` line table | ✓ `SEED_LINES` (3 items) |
| `wo.invoice.invoice_id` | backend | `Step5Approved` label, `ArmorIQGate` action | ✓ "INV-1041" |
| `fileName` prop | App.tsx | `FileChip` in Step1, `ArmorIQGate` action | ✗ **always falls back to hardcoded "work-order-WO-1041.pdf"** (prop not passed from App.tsx) |
| `getLocalParts` location | hardcoded | `InboundPartsView` | "412 Cedar Court" — not derived from `wo` |

### Loading / error / empty states

| Fetch | Loading UI | Error UI | Empty UI |
|---|---|---|---|
| `createWorkOrder` (DropZone intake) | ✗ none — no `intakeLoading` state in App.tsx | ✓ catch → `workOrderId=null` → mock mode | n/a |
| `getWorkOrder` poll (step 1) | ✓ `polling` prop drives ReasoningRow spinner | ✗ error → silent 2s retry, no cap, no error banner | ✓ shows mock animation while `wo=null` |
| `approveStage` (every step advance) | ✓ `approving` state → spinner on button | ✓ catch → silent advance in mock mode | n/a |
| `getLocalParts` | ✓ pure mock, synchronous (no loading) | n/a | n/a |
| `prepareCheckout` | ✓ `isCheckingOut` per store row | ✓ catch updates `CheckoutState.error` | n/a |
| Invoice data (step 4) | ✓ arrives via `wo` polling; no separate fetch | n/a | ✓ `SEED_LINES` fallback |

---

## ISSUES REGISTER

### HIGH — breaks the demo

```
[HIGH] App.tsx:53   NeedsYou rendered with no props — onApprove/onView both absent.
                    "Approve" and "View" CTAs are dead buttons on the demo's primary action widget.
                    Fix: pass onApprove={(id) => openFlow(id, "invoice")} onView={(id) => openFlow(id, "inbound")}
                    (requires adding openFlow helper to App.tsx — already exists on fix/dashboard-jsx-unclosed-div branch)

[HIGH] App.tsx:52   SearchBar rendered with no onSelect prop.
                    Clicking any search result does nothing; field goes nowhere.
                    Fix: pass onSelect={(r) => { if (r.type==="workOrder") openFlow(r.id,"inbound",r.title) }}

[HIGH] App.tsx:55   WorkOrders onViewOrder ignores row.id and row.title.
                    Opens flow in mock mode (workOrderId=null); Step 1 polling never starts;
                    FileChip shows wrong filename.
                    Fix: onViewOrder={(row) => openFlow(row.id, "inbound", row.title)}

[HIGH] App.tsx      No intakeLoading state — DropZone shows no feedback while createWorkOrder()
                    resolves. On slow/failed backend, user sees a blank pause then instant jump.
                    Fix: add intakeLoading state; pass loading={intakeLoading} to DropZone;
                    set true before fetch, false on completion (handled on fix/dashboard-jsx-unclosed-div)
```

### MEDIUM — visible, not blocking the golden path

```
[MEDIUM] WorkOrderToInvoiceFlow.tsx:905-924
                    Poll loop has no MAX_ATTEMPTS cap. If backend stays down after createWorkOrder
                    succeeds (workOrderId is set), spinner runs forever with no user-facing error.
                    Fix: add attempt counter; after 8 attempts (~4s) show error banner and advance
                    in mock mode.

[MEDIUM] App.tsx    WorkOrderToInvoiceFlow only receives onBack + workOrderId (no fileName,
                    initialStep, backendError). FileChip always shows hardcoded "work-order-WO-1041.pdf"
                    regardless of the actual uploaded file.
                    Fix: pass fileName={fileName} — requires adding fileName state to App.tsx
                    (already done on fix/dashboard-jsx-unclosed-div branch).
```

### LOW — polish

```
[LOW] NeedsYou.tsx:33    rounded-md on badge — should be rounded-[6px]
[LOW] NeedsYou.tsx:48    rounded-lg on button base — should be rounded-[8px]
[LOW] WorkOrderToInvoiceFlow.tsx:576   shadow-sm on active tab pill
[LOW] InboundPartsView.tsx:327         shadow-lg on filter dropdown  
[LOW] InboundPartsView.tsx:726         shadow-sm on Map/List tab pill
[LOW] InboundPartsView.tsx:1002        shadow-sm on fulfillment tab pill
[LOW] PricingView.tsx:473              shadow-sm on sort/filter tab pill
```

---

## TOP 3 TO FIX NEXT

**1. Merge and apply fix/dashboard-jsx-unclosed-div into this branch (HIGH ×4)**
That branch already has `openFlow`, `initialStep`, `intakeLoading`, `fileName`,
`backendError`, and wired `NeedsYou`/`SearchBar`/`WorkOrders` callbacks. It fixes all four
HIGH issues in one rebase.

**2. Add polling MAX_ATTEMPTS cap (MEDIUM)**
`WorkOrderToInvoiceFlow.tsx` poll loop at line 905: add `let attempts = 0; if (++attempts
>= 8) { clearTimeout(tid); /* show error / advance mock */ }`. Eight attempts ≈ 4 seconds —
enough for the real agent, fast enough to not hang the demo.

**3. Replace all five `shadow-sm` tab pills with hairline border (LOW ×5)**
Same one-line fix in three files: swap `"… shadow-sm"` → `"… border border-[var(--color-hairline)]"`
on the active tab state. Extract a shared `TabPill` component to prevent drift.

---

## OVERALL DEMO-READINESS

```
Golden path (DropZone → 5 steps → send): ██████████ 100% — fully wired, no dead ends
Dashboard entry points:                  ██░░░░░░░░  20% — only DropZone works; NeedsYou,
                                                            SearchBar, WorkOrders are dead or partial
Design-system fidelity (in-flow):        ████████░░  80% — 7 LOW token violations, all shadows on tabs
Data threading:                          ████████░░  80% — fileName not passed; location hardcoded
Error resilience:                        ██████░░░░  60% — poll loop unbounded; intake has no spinner

OVERALL: 68% demo-ready
```

The 5-step flow itself is solid and would survive a live demo from a file drop. The dashboard
facade is mostly static — clicking anything except the DropZone does nothing. Fix the three
items above (especially the branch merge) and readiness jumps to ~90%.
