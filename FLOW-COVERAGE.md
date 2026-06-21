# Flow-Coverage Audit
**Branch:** `michelle/intake-clarity` · **Date:** 2026-06-21

---

## Section 1 — Screen & Navigation Map

### Dashboard (`view="dashboard"`)

```
Dashboard
├─ NeedsYou "Approve" button          → ❌ NO-OP (no onClick)
├─ NeedsYou "View" button             → ❌ NO-OP (no onClick)
├─ DropZone upload (file drop / pick) → ✅ view="invoice-flow", workOrderId set
├─ DropZone paste (textarea + submit) → ✅ view="invoice-flow", workOrderId set
├─ SearchBar result click             → ❌ NO-OP (closes dropdown, no navigation)
├─ WorkOrders "View order"            → ⚠️  view="invoice-flow", workOrderId=null
├─ Sidebar — all nav items            → ❌ href="#" (dead)
└─ Clients folder cards               → ❌ href="#" (dead)
```

### Invoice Flow (`view="invoice-flow"`)

```
InvoiceFlow (top shell)
├─ "Back to dashboard" (top-left)     → ✅ view="dashboard"
└─ StageStepper badges
   ├─ Completed stage                 → ✅ jump to that stage's first step
   ├─ Current stage                   → no-op (correct)
   └─ Future stage                    → disabled (correct)

Step 1 — Inbound (step="inbound")
├─ Polls GET /work-orders/{id}        → ✅ (with 2s error retry)
├─ InboundPartsView filters           → local state only (no nav)
├─ InboundPartsView "Review & check out" per store
│  └─ prepareCheckout() → open URL   → ⚠️  mock URL only
├─ No secondary back button           → ✅ correct (first step)
└─ "Schedule the visit"               → ✅ approveStage("intake") + step="schedule"

Step 2 — Schedule (step="schedule")
├─ Slot picker                        → local state (no nav)
├─ "Back to Inbound"                  → ✅ step="inbound"
└─ "Approve & send"                   → ✅ approveStage("scheduling") + step="postjob"

Step 3 — Post-job (step="postjob")
├─ "Back to Schedule"                 → ✅ step="schedule"
└─ "See the invoice"                  → ✅ step="invoice" (no approval call)

Step 4 — Invoice (step="invoice")
├─ Tab: Document                      → ✅ BrandedInvoice
├─ Tab: Edit                          → ✅ EditSplit (line items editable)
├─ Tab: Pricing                       → ✅ PricingView
├─ PricingView "Reserve for pickup"   → ⚠️  local toggle only (no backend call)
├─ "Back to Post-job"                 → ✅ step="postjob"
└─ "Approve invoice"                  → ✅ approveStage("invoice") + step="approved"

Step 5 — Approved (step="approved")
├─ "Send invoice" button              → ⚠️  setSent(true) only — no API call
├─ "Run again"                        → ✅ step="inbound", wo=null
└─ "Back to dashboard"                → ✅ view="dashboard"
```

---

## Section 2 — Core Flow Confirmation

| Flow | Steps | Status | Notes |
|------|-------|--------|-------|
| **Intake: drop file → create WO** | 4/4 | ✅ Complete | Both file and paste paths work |
| **Intake: paste text → create WO** | 4/4 | ✅ Complete | New on this branch |
| **Inbound: read → classify → parts** | 7/8 | ⚠️ Partial | Checkout is mock-only; no error state on poll failure |
| **Schedule: times → outreach → approve** | 5/5 | ✅ Complete | |
| **Post-job: source → reasoning → draft** | 4/4 | ✅ Complete | |
| **Invoice: Document / Edit / Pricing → approve** | 9/9 | ✅ Complete | Reserve for pickup is local-only |
| **Approved: send / run-again / back** | 2/3 | ⚠️ Partial | "Send invoice" does not actually send |
| **Back nav: dashboard / stepper / per-step** | 5/5 | ✅ Complete | |
| **Mobile responsiveness** | All | ✅ Complete | Responsive Tailwind classes throughout |
| **Intake follow-up questions (incomplete WO)** | 0/? | ❌ Missing | No UI for the question loop |
| **Voice capture on Step 3** | 0/1 | ❌ Missing | Step 3 shows static reading; no mic/record UI |

---

## Section 3 — Gap Flags

### HIGH — blocks demo

| # | Gap | File · Line | Category |
|---|-----|-------------|----------|
| H1 | NeedsYou "Approve" and "View" buttons have no onClick | `NeedsYou.tsx:51–63, 87` | dead-end |
| H2 | SearchBar results do not navigate anywhere | `SearchBar.tsx:99–102` | dead-end |
| H3 | WorkOrders "View order" navigates with workOrderId=null | `App.tsx:84, WorkOrders.tsx:313` | broken-binding |
| H4 | createWorkOrder failure swallowed; flow launches with null WO | `App.tsx:29–32, 40–43` | missing-state |
| H5 | getWorkOrder poll failure shows spinner forever (no error UI) | `WorkOrderToInvoiceFlow.tsx:1145–1146` | missing-state |
| H6 | approveStage failure is console.warn'd but step advances anyway | `WorkOrderToInvoiceFlow.tsx:1170` | broken-binding |
| H7 | "Send invoice" does not call any API — local toggle only | `WorkOrderToInvoiceFlow.tsx:1056` | dead-end |

### MEDIUM — visible but non-fatal

| # | Gap | File · Line | Category |
|---|-----|-------------|----------|
| M1 | InboundPartsView checkout calls mock prepareCheckout (fake URL) | `InboundPartsView.tsx:151–162, 770–792` | missing-state |
| M2 | PricingView "Reserve for pickup" is local toggle, no backend | `PricingView.tsx:325` | dead-end |
| M3 | Sidebar all nav links are href="#" — dead | `Sidebar.tsx:37` | dead-end |
| M4 | Clients folder cards are href="#" — dead | `Clients.tsx:19–22` | dead-end |
| M5 | BrandedInvoice entity extraction is regex-fragile; blank fields if entities missing | `BrandedInvoice.tsx:44–113` | broken-binding |
| M6 | Step5 client name can be null → "Invoice approved · $425.00" (no client) | `WorkOrderToInvoiceFlow.tsx:1016–1025` | broken-binding |
| M7 | No empty state when all parts have 0 suppliers matching filters | `InboundPartsView.tsx:539–542` | empty-state |
| M8 | Invoice line items default to $0 if rate/qty keys missing — silent | `WorkOrderToInvoiceFlow.tsx:100–101` | broken-binding |
| M9 | wo.schedule.parts_suggestion missing → InboundPartsView silently uses mock ANTICIPATED_PARTS with no label differentiating "mock" vs "real" | `InboundPartsView.tsx:818–819` | missing-state |

### LOW — edge cases / polish

| # | Gap | File · Line | Category |
|---|-----|-------------|----------|
| L1 | WorkOrderPipeline.tsx and SchedulingView.tsx are imported nowhere (dead code) | `WorkOrderPipeline.tsx, SchedulingView.tsx` | orphan |
| L2 | Mock reasoning animation hardcoded at 2 s; races real backend response | `WorkOrderToInvoiceFlow.tsx:363` | missing-state |
| L3 | StageStepper badge count hardcoded as 3 in NeedsYou but only 2 items render | `NeedsYou.tsx:68` | broken-binding |
| L4 | Voice capture UI (Step 3 post-job) entirely absent — only static source card | `WorkOrderToInvoiceFlow.tsx:628–720` | unreachable |
| L5 | No "incomplete work order" follow-up question flow in UI | (missing screen) | unreachable |
| L6 | SearchBar has no "no results" call-to-action ("Try creating one?") | `SearchBar.tsx:124–127` | empty-state |

---

## Section 4 — Coverage Table

| Flow | Steps mapped | Status | Top gap |
|------|-------------|--------|---------|
| Intake: file drop | 4/4 | ✅ Complete | — |
| Intake: paste text | 4/4 | ✅ Complete | — |
| Inbound step | 7/8 | ⚠️ Partial | H5 — poll error loops silently |
| Schedule step | 5/5 | ✅ Complete | — |
| Post-job step | 4/4 | ✅ Complete | L4 — voice capture absent |
| Invoice step | 9/9 | ✅ Complete | M2 — reserve is local-only |
| Approved step | 2/3 | ⚠️ Partial | H7 — send does nothing |
| Back navigation | 5/5 | ✅ Complete | — |
| Dashboard CTAs | 1/4 | ❌ Broken | H1, H2, H3 — three dead surfaces |
| Mobile layout | all | ✅ Complete | — |
| Follow-up questions | 0/? | ❌ Missing | L5 — no UI exists |
| Voice capture | 0/1 | ❌ Missing | L4 — no UI exists |

---

## Top Gaps — Ranked

**Fix before any demo run:**

1. **[H1]** NeedsYou buttons are dead — the primary dashboard action does nothing.
   `NeedsYou.tsx:87` — add `onClick` + pass `onApprove` / `onView` from `App.tsx`.

2. **[H3]** "View order" in the work-orders table launches the flow with no work-order ID.
   `App.tsx:84` — extract `row.id`, call `setWorkOrderId(row.id)` before `setView`.

3. **[H2]** SearchBar results click fires no navigation.
   `SearchBar.tsx:99–102` — add `onSelect` prop, navigate to the flow with the selected ID.

4. **[H4]** Intake failure is silently swallowed; user lands on a broken flow with no message.
   `App.tsx:29–32, 40–43` — show an error notice; do not call `setView("invoice-flow")` if the WO was not created.

5. **[H5]** Poll failure on Step 1 shows a spinner forever.
   `WorkOrderToInvoiceFlow.tsx:1145` — add `pollError` state; render "Failed to reach backend" with a retry.

6. **[H6]** approveStage failure silently advances the step.
   `WorkOrderToInvoiceFlow.tsx:1170` — surface a toast / inline error; gate `setStep` on success only.

7. **[H7]** "Send invoice" is a local toggle — no email sent.
   `WorkOrderToInvoiceFlow.tsx:1056` — call a send endpoint or at minimum open a `mailto:` link; do not show a "Sent ✓" if nothing was sent.

**Fix for polish (before sharing a recording):**

8. **[M5]** BrandedInvoice blank fields if entities extraction fails.
9. **[M9]** InboundPartsView shows mock parts with no label when `parts_suggestion` is empty.
10. **[L3]** NeedsYou badge says "3" but 2 items render.
