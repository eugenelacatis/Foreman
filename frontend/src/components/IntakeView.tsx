import { useState } from "react";
import { approveStage, WorkOrder } from "../api/client";

interface IntakeViewProps {
  workOrder: WorkOrder;
  onUpdate: (wo: WorkOrder) => void;
}

export default function IntakeView({ workOrder, onUpdate }: IntakeViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = workOrder.classification;

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      const updated = await approveStage(workOrder.id, "intake");
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Raw request */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Raw Request
        </h3>
        <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
          {workOrder.raw_request}
        </p>
      </div>

      {/* Classification */}
      {c ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Classification
          </h3>

          {/* Job type */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 font-medium">Job type:</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              {c.job_type}
            </span>
          </div>

          {/* Entities */}
          {Object.keys(c.entities).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Entities
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {Object.entries(c.entities).map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-xs text-gray-400 capitalize">
                      {k.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-sm text-gray-800 font-medium">
                      {String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Completeness flags */}
          {c.completeness_flags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Completeness flags
              </p>
              <div className="flex flex-wrap gap-2">
                {c.completeness_flags.map((flag) => (
                  <span
                    key={flag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-400 italic">
          Classification pending...
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleApprove}
        disabled={loading || !c || workOrder.approvals.intake_approved}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {loading
          ? "Approving..."
          : workOrder.approvals.intake_approved
            ? "Intake Approved"
            : "Approve Intake"}
      </button>
    </div>
  );
}
