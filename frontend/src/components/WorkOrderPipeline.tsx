import { useState } from "react";
import { WorkOrder } from "../api/client";
import ArmorIQBlock from "./ArmorIQBlock";
import IntakeView from "./IntakeView";
import InvoicingView from "./InvoicingView";
import SchedulingView from "./SchedulingView";

interface WorkOrderPipelineProps {
  workOrder: WorkOrder;
  onUpdate: (wo: WorkOrder) => void;
}

interface ArmorIQState {
  action: string;
  reason: string;
}

const STAGES = [
  { key: "intake", label: "Intake" },
  { key: "scheduling", label: "Scheduling" },
  { key: "invoicing", label: "Invoicing" },
] as const;

function stageIndex(status: WorkOrder["status"]): number {
  if (status === "complete") return 3;
  return STAGES.findIndex((s) => s.key === status);
}

export default function WorkOrderPipeline({
  workOrder,
  onUpdate,
}: WorkOrderPipelineProps) {
  const [armoriq, setArmoriq] = useState<ArmorIQState | null>(null);
  const currentIdx = stageIndex(workOrder.status);

  function triggerArmorIQ() {
    setArmoriq({
      action: "approve_invoice without human confirmation",
      reason:
        "ArmorIQ detected an attempt to commit an invoice outside the approved plan. A human must confirm before this action proceeds.",
    });
  }

  return (
    <div className="space-y-8">
      {/* 3-step progress indicator */}
      <div className="flex items-center">
        {STAGES.map((stage, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          return (
            <div
              key={stage.key}
              className="flex items-center flex-1 last:flex-none"
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                    done
                      ? "bg-green-500 border-green-500 text-white"
                      : active
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-300 text-gray-400"
                  }`}
                >
                  {done ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs font-semibold ${
                    active
                      ? "text-blue-600"
                      : done
                        ? "text-green-600"
                        : "text-gray-400"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-12px] transition-colors ${
                    currentIdx > i ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Work order ID + trace */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>
          ID:{" "}
          <code className="font-mono">{workOrder.id.slice(0, 8)}&hellip;</code>
        </span>
        {workOrder.trace_id && (
          <span>
            Trace:{" "}
            <code className="font-mono">
              {workOrder.trace_id.slice(0, 8)}&hellip;
            </code>
          </span>
        )}
        <span
          className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            workOrder.status === "complete"
              ? "bg-green-100 text-green-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {workOrder.status}
        </span>
      </div>

      {/* Stage content */}
      {workOrder.status === "intake" && (
        <IntakeView workOrder={workOrder} onUpdate={onUpdate} />
      )}
      {workOrder.status === "scheduling" && (
        <SchedulingView workOrder={workOrder} onUpdate={onUpdate} />
      )}
      {workOrder.status === "invoicing" && (
        <InvoicingView
          workOrder={workOrder}
          onUpdate={onUpdate}
          onTriggerArmorIQ={triggerArmorIQ}
        />
      )}
      {workOrder.status === "complete" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-green-700 font-semibold text-lg">
            Work order complete
          </p>
          <p className="text-green-600 text-sm mt-1">All stages approved.</p>
        </div>
      )}

      {armoriq && (
        <ArmorIQBlock
          action={armoriq.action}
          reason={armoriq.reason}
          onDismiss={() => setArmoriq(null)}
        />
      )}
    </div>
  );
}
