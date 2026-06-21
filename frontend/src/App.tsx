import { useState } from "react";
import Sidebar from "./components/Sidebar";
import DropZone from "./components/DropZone";
import SearchBar from "./components/SearchBar";
import NeedsYou from "./components/NeedsYou";
import Clients from "./components/Clients";
import WorkOrders from "./components/WorkOrders";
import WorkOrderToInvoiceFlow from "./components/invoice-flow/WorkOrderToInvoiceFlow";

// NOTE: The typed API client and the legacy intake/scheduling/invoicing views
// remain available in `./api/client` and `./components/*View.tsx`. The new
// dashboard runs on mock data; we'll wire the flow into the real
// createWorkOrder / approveStage calls in a follow-up.

type View = "dashboard" | "invoice-flow";

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  const startFlow = () => setView("invoice-flow");
  const backToDashboard = () => setView("dashboard");

  return (
    <div className="flex min-h-screen items-start bg-white text-[var(--color-ink)]">
      <Sidebar />

      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-8 lg:px-12 py-8 lg:py-10">
          {view === "dashboard" ? (
            <>
              <h1 className="font-display mb-7 text-[24px] font-semibold tracking-tight text-[var(--color-ink)]">
                Dashboard
              </h1>

              <div className="flex flex-col gap-7">
                <DropZone onFile={startFlow} />
                <SearchBar />
                <NeedsYou />
                <Clients />
                <WorkOrders onViewOrder={startFlow} />
              </div>
            </>
          ) : (
            <WorkOrderToInvoiceFlow onBack={backToDashboard} />
          )}
        </div>
      </main>
    </div>
  );
}
