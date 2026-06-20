import { useState } from "react";
import { createWorkOrder, WorkOrder } from "./api/client";
import WorkOrderPipeline from "./components/WorkOrderPipeline";

export default function App() {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [rawRequest, setRawRequest] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = rawRequest.trim();
    if (!text) return;
    setIsLoading(true);
    setError(null);
    try {
      const wo = await createWorkOrder(text);
      setWorkOrder(wo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create work order",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">
              ForemanAI
            </span>
          </div>
          {workOrder && (
            <button
              onClick={() => {
                setWorkOrder(null);
                setRawRequest("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              New work order
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {!workOrder ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                Submit a Work Order
              </h1>
              <p className="text-gray-500 text-sm">
                Describe the job in plain language. The pipeline handles the
                rest.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={rawRequest}
                onChange={(e) => setRawRequest(e.target.value)}
                placeholder="e.g. HVAC unit at 123 Main St stopped working overnight. Tenant reports no heat. Unit is a Carrier 3-ton split system, installed 2019."
                rows={6}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={isLoading || !rawRequest.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {isLoading ? "Creating work order..." : "Submit Work Order"}
              </button>
            </form>
          </div>
        ) : (
          <WorkOrderPipeline workOrder={workOrder} onUpdate={setWorkOrder} />
        )}
      </main>
    </div>
  );
}
