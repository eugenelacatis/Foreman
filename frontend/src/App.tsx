import { useState } from "react";
import Sidebar from "./components/Sidebar";
import DropZone from "./components/DropZone";
import SearchBar from "./components/SearchBar";
import NeedsYou from "./components/NeedsYou";
import Clients from "./components/Clients";
import WorkOrders from "./components/WorkOrders";
import WorkOrderToInvoiceFlow from "./components/invoice-flow/WorkOrderToInvoiceFlow";
import { createWorkOrder } from "./api/client";

type View = "dashboard" | "invoice-flow";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const startFlowWithFile = async (file: File) => {
    setFileName(file.name);
    let rawRequest: string;
    if (file.name.endsWith(".txt") || file.name.endsWith(".eml")) {
      rawRequest = await file.text().catch(() => file.name);
    } else {
      rawRequest = file.name;
    }
    try {
      const wo = await createWorkOrder(rawRequest);
      setWorkOrderId(wo.id);
    } catch {
      setWorkOrderId(null);
    }
    setView("invoice-flow");
  };

  const startFlowWithText = async (text: string) => {
    setFileName("manual entry");
    try {
      const wo = await createWorkOrder(text);
      setWorkOrderId(wo.id);
    } catch {
      setWorkOrderId(null);
    }
    setView("invoice-flow");
  };

  const backToDashboard = () => {
    setView("dashboard");
    setWorkOrderId(null);
    setFileName(null);
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
                <NeedsYou />

                {/* Divider */}
                <div className="h-px bg-[var(--color-hairline)]" />

                {/* New intake — secondary, below the queue */}
                <section>
                  <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-widest text-[var(--color-ink-3)]">
                    New work order
                  </p>
                  <DropZone onFile={startFlowWithFile} onText={startFlowWithText} />
                </section>

                {/* Work order history with its own filter */}
                <section>
                  <SearchBar />
                  <div className="mt-4">
                    <WorkOrders onViewOrder={() => setView("invoice-flow")} />
                  </div>
                </section>

                {/* Clients — reference, not primary action */}
                <Clients />
              </div>
            </>
          ) : (
            <WorkOrderToInvoiceFlow onBack={backToDashboard} workOrderId={workOrderId} fileName={fileName} />
          )}
        </div>
      </main>
    </div>
  );
}
