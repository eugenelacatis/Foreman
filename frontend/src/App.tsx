import { useState } from "react";
import Sidebar from "./components/Sidebar";
import DropZone from "./components/DropZone";
import SearchBar from "./components/SearchBar";
import type { SearchResult } from "./components/SearchBar";
import NeedsYou from "./components/NeedsYou";
import Clients from "./components/Clients";
import WorkOrders from "./components/WorkOrders";
import WorkOrderToInvoiceFlow from "./components/invoice-flow/WorkOrderToInvoiceFlow";
import type { StepKey } from "./components/invoice-flow/WorkOrderToInvoiceFlow";
import { createWorkOrder } from "./api/client";

type View = "dashboard" | "invoice-flow";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [initialStep, setInitialStep] = useState<StepKey>("inbound");
  const [backendError, setBackendError] = useState<string | null>(null);
  const [intakeLoading, setIntakeLoading] = useState(false);

  const openFlow = (id: string | null, step: StepKey = "inbound", title?: string | null) => {
    setWorkOrderId(id);
    setFileName(title ?? null);
    setInitialStep(step);
    setBackendError(null);
    setIntakeLoading(false);
    setView("invoice-flow");
  };

  const startFlowWithFile = async (file: File) => {
    setIntakeLoading(true);
    let rawRequest: string;
    if (file.name.endsWith(".txt") || file.name.endsWith(".eml")) {
      rawRequest = await file.text().catch(() => file.name);
    } else {
      rawRequest = file.name;
    }
    try {
      const wo = await createWorkOrder(rawRequest);
      openFlow(wo.id, "inbound", file.name);
    } catch {
      openFlow(null, "inbound", file.name);
      setBackendError("Backend unavailable — running in demo mode with sample data.");
    }
  };

  const startFlowWithText = async (text: string) => {
    setIntakeLoading(true);
    try {
      const wo = await createWorkOrder(text);
      openFlow(wo.id, "inbound", "manual entry");
    } catch {
      openFlow(null, "inbound", "manual entry");
      setBackendError("Backend unavailable — running in demo mode with sample data.");
    }
  };

  const backToDashboard = () => {
    setView("dashboard");
    setWorkOrderId(null);
    setFileName(null);
    setBackendError(null);
  };

  return (
    <div className="flex min-h-screen items-start bg-white text-[var(--color-ink)]">
      <Sidebar />

      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-8 lg:px-12 py-8 lg:py-10">
          {view === "dashboard" ? (
            <>
              {/* Page label — quiet, not competing with content below */}
              <p className="mb-6 text-[11.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
                Dashboard
              </p>

              <div className="flex flex-col gap-8">
                {/* Primary focal point — things that need action right now */}
                <NeedsYou
                  onApprove={() => openFlow(null, "invoice")}
                  onView={() => openFlow(null, "inbound")}
                />

                {/* Divider */}
                <div className="h-px bg-[var(--color-hairline)]" />

                {/* New intake — secondary, below the queue */}
                <section>
                  <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
                    New work order
                  </p>
                  <DropZone onFile={startFlowWithFile} onText={startFlowWithText} loading={intakeLoading} />
                </section>

                {/* Work order history with its own filter */}
                <section>
                  <SearchBar
                    onSelect={(r: SearchResult) => {
                      if (r.type === "workOrder") openFlow(r.id, "inbound", r.title);
                    }}
                  />
                  <div className="mt-4">
                    <WorkOrders
                      onViewOrder={(row) => openFlow(row.id, "inbound", row.title)}
                    />
                  </div>
                </section>

                {/* Clients — reference, not primary action */}
                <Clients />
              </div>
            </>
          ) : (
            <WorkOrderToInvoiceFlow
              onBack={backToDashboard}
              workOrderId={workOrderId}
              fileName={fileName}
              initialStep={initialStep}
              backendError={backendError}
            />
          )}
        </div>
      </main>
    </div>
  );
}
