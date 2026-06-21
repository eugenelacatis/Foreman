import { useState } from "react";
import { approveStage, WorkOrder } from "../api/client";

interface SchedulingViewProps {
  workOrder: WorkOrder;
  onUpdate: (wo: WorkOrder) => void;
}

export default function SchedulingView({
  workOrder,
  onUpdate,
}: SchedulingViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = workOrder.schedule;

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      const updated = await approveStage(workOrder.id, "scheduling");
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setLoading(false);
    }
  }

  if (!s) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-400 italic">
        Scheduling in progress...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Proposed times */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Proposed Times
        </h3>
        {s.proposed_times.length > 0 ? (
          <ul className="space-y-2">
            {s.proposed_times.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-gray-800"
              >
                <svg
                  className="w-4 h-4 text-green-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 italic">No times proposed yet.</p>
        )}
      </div>

      {/* Outreach draft */}
      {s.outreach_draft && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Outreach Draft
          </h3>
          <textarea
            readOnly
            value={typeof s.outreach_draft === "string" ? s.outreach_draft : JSON.stringify(s.outreach_draft, null, 2)}
            rows={6}
            className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 resize-none font-mono leading-relaxed focus:outline-none"
          />
        </div>
      )}

      {/* Parts suggestion */}
      {s.parts_suggestion.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Suggested Parts
          </h3>
          <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-3">
            Estimated — verify before ordering
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Part
                </th>
                <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Est. Price
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {s.parts_suggestion.map((part, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-800">
                    {part.name ?? JSON.stringify(part)}
                  </td>
                  <td className="py-2 text-right text-gray-600">
                    {part.price != null
                      ? `$${Number(part.price).toFixed(2)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleApprove}
        disabled={loading || workOrder.approvals.scheduling_approved}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {loading
          ? "Approving..."
          : workOrder.approvals.scheduling_approved
            ? "Scheduling Approved"
            : "Approve Scheduling"}
      </button>
    </div>
  );
}
