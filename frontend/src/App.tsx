import { useState } from "react";
import { Mic } from "lucide-react";
import Sidebar from "./components/Sidebar";
import DropZone from "./components/DropZone";
import SearchBar from "./components/SearchBar";
import type { SearchResult } from "./components/SearchBar";
import NeedsYou from "./components/NeedsYou";
import WorkOrders from "./components/WorkOrders";
import WorkOrderToInvoiceFlow from "./components/invoice-flow/WorkOrderToInvoiceFlow";
import type { StepKey } from "./components/invoice-flow/WorkOrderToInvoiceFlow";
import VoiceIntake from "./components/VoiceIntake";
import ClientsView from "./components/ClientsView";
import ApprovalsView from "./components/ApprovalsView";
import { createWorkOrder } from "./api/client";
import type { WorkOrder } from "./api/client";

type View = "dashboard" | "invoice-flow" | "clients" | "approvals";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [initialStep, setInitialStep] = useState<StepKey>("inbound");
  const [pendingApprovals, setPendingApprovals] = useState(3);

  const openFlow = (id: string | null, step: StepKey, title?: string | null) => {
    setWorkOrderId(id);
    setFileName(title ?? null);
    setInitialStep(step);
    setIntakeLoading(false);
    setBackendError(null);
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
      setIntakeLoading(false);
      setWorkOrderId(null);
    }
  };

  const startFlowWithText = async (text: string) => {
    setIntakeLoading(true);
    try {
      const wo = await createWorkOrder(text);
      openFlow(wo.id, "inbound", null);
    } catch {
      setIntakeLoading(false);
      setWorkOrderId(null);
    }
  };

  const startFlowWithVoice = (wo: WorkOrder) => {
    setShowVoice(false);
    openFlow(wo.id, "inbound", "voice-intake.wav");
  };

  const backToDashboard = () => {
    setView("dashboard");
    setWorkOrderId(null);
    setFileName(null);
    setBackendError(null);
  };

  return (
    <div className="flex min-h-screen items-start bg-white text-[var(--color-ink)]">
      <Sidebar
        activeKey={view === "invoice-flow" ? "dashboard" : view}
        onNav={(key) => {
          if (key === "clients") setView("clients");
          else if (key === "approvals") setView("approvals");
          else if (key === "dashboard") backToDashboard();
        }}
        approvalsCount={pendingApprovals}
      />

      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-8 lg:px-12 py-8 lg:py-10">
          {view === "approvals" ? (
            <ApprovalsView
              onBack={backToDashboard}
              onSent={() => setPendingApprovals((p) => Math.max(0, p - 1))}
            />
          ) : view === "clients" ? (
            <ClientsView />
          ) : view === "dashboard" ? (
            <>
              <p className="mb-6 text-[11.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
                Dashboard
              </p>

              <div className="flex flex-col gap-8">
                <NeedsYou
                  onApprove={(id) => openFlow(id, "invoice")}
                  onView={(id) => openFlow(id, "inbound")}
                />

                <div className="h-px bg-[var(--color-hairline)]" />

                <section>
                  <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
                    New work order
                  </p>
                  <DropZone onFile={startFlowWithFile} onText={startFlowWithText} loading={intakeLoading} />
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[var(--color-hairline)]" />
                    <span className="text-[12.5px] text-[var(--color-ink-3)]">or</span>
                    <div className="h-px flex-1 bg-[var(--color-hairline)]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVoice(true)}
                    className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-[var(--color-hairline)] bg-white py-4 text-[14px] font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-tint)]"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
                      <Mic size={16} strokeWidth={2} />
                    </span>
                    Describe the work order by voice
                  </button>
                </section>

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
