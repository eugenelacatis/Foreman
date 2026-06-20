import { useEffect, useRef, useState } from "react";
import { approveStage, sendInvoiceMessage, WorkOrder } from "../api/client";

interface InvoicingViewProps {
  workOrder: WorkOrder;
  onUpdate: (wo: WorkOrder) => void;
  onTriggerArmorIQ: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function InvoicingView({
  workOrder,
  onUpdate,
  onTriggerArmorIQ,
}: InvoicingViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const inv = workOrder.invoice;
  const c = workOrder.classification;
  const s = workOrder.schedule;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);
    setError(null);
    try {
      const res = await sendInvoiceMessage(workOrder.id, text);
      setMessages((prev) => [...prev, { role: "assistant", text: res.reply }]);
      onUpdate(res.work_order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed");
    } finally {
      setChatLoading(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      const updated = await approveStage(workOrder.id, "invoice");
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel: work order summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Work Order Summary
          </h3>

          {c && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Job type:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {c.job_type}
                </span>
              </div>
              {Object.keys(c.entities).length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                  {Object.entries(c.entities).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-gray-400 capitalize">
                        {k.replace(/_/g, " ")}
                      </dt>
                      <dd className="text-sm text-gray-800 font-medium">
                        {String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {s && s.proposed_times.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Scheduled times</p>
              <ul className="space-y-1">
                {s.proposed_times.map((t, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {inv && inv.line_items.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Line items</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {inv.line_items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-1 text-gray-700">
                        {String(
                          item.description ?? item.name ?? JSON.stringify(item),
                        )}
                      </td>
                      <td className="py-1 text-right text-gray-600">
                        {item.amount != null
                          ? `$${Number(item.amount).toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel: invoice draft */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Invoice Draft
          </h3>
          {inv?.template_filled ? (
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100 overflow-auto max-h-72">
              {inv.template_filled}
            </pre>
          ) : (
            <p className="text-sm text-gray-400 italic">
              Invoice template not yet filled. Use the chat below to complete
              it.
            </p>
          )}
        </div>
      </div>

      {/* Gap-fill chat */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Invoice Assistant
          </h3>
        </div>

        <div className="h-56 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 italic">
              Ask the assistant to fill in missing invoice details.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-gray-400 italic">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about missing details..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onTriggerArmorIQ}
          className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          Test ArmorIQ Block
        </button>
        <button
          onClick={handleApprove}
          disabled={
            approving ||
            !inv?.template_filled ||
            workOrder.approvals.invoice_approved
          }
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {approving
            ? "Approving..."
            : workOrder.approvals.invoice_approved
              ? "Invoice Approved"
              : "Approve Invoice"}
        </button>
      </div>
    </div>
  );
}
