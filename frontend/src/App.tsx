import { useState } from "react";
import { Mic } from "lucide-react";
import Sidebar from "./components/Sidebar";
import DropZone from "./components/DropZone";
import SearchBar from "./components/SearchBar";
import type { SearchResult } from "./components/SearchBar";
import NeedsYou from "./components/NeedsYou";
import Clients from "./components/Clients";
import WorkOrders from "./components/WorkOrders";
import WorkOrderToInvoiceFlow from "./components/invoice-flow/WorkOrderToInvoiceFlow";
import VoiceIntake from "./components/VoiceIntake";
import { createWorkOrder } from "./api/client";
import type { WorkOrder } from "./api/client";

type View = "dashboard" | "invoice-flow";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showVoice, setShowVoice] = useState(false);

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
      setWorkOrderId(null);
    }
  };

  const startFlowWithVoice = (wo: WorkOrder) => {
    setShowVoice(false);
    setFileName("voice-intake.wav");
    setWorkOrderId(wo.id);
    setView("invoice-flow");
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

              <div className="flex flex-col gap-7">
                <div className="flex flex-col gap-3">
                  <DropZone onFile={startFlowWithFile} />
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-[var(--color-hairline)]" />
                    <span className="text-[12.5px] text-[var(--color-ink-3)]">or</span>
                    <div className="h-px flex-1 bg-[var(--color-hairline)]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVoice(true)}
                    className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-[var(--color-hairline)] bg-white py-4 text-[14px] font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-tint)]"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
                      <Mic size={16} strokeWidth={2} />
                    </span>
                    Describe the work order by voice
                  </button>
                </div>
                <SearchBar />
                <NeedsYou />
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

      {showVoice && (
        <VoiceIntake
          onComplete={startFlowWithVoice}
          onClose={() => setShowVoice(false)}
        />
      )}
    </div>
  );
}
