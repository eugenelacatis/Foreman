const BASE = "/api";

export type WorkOrderStatus =
  | "intake"
  | "scheduling"
  | "invoicing"
  | "complete";

export interface Classification {
  job_type: string;
  entities: Record<string, unknown>;
  completeness_flags: string[];
}

export interface Schedule {
  proposed_times: string[];
  outreach_draft: string;
  parts_suggestion: Array<{
    name: string;
    price?: number;
    [key: string]: unknown;
  }>;
}

export interface Invoice {
  line_items: Array<{
    description: string;
    amount: number;
    [key: string]: unknown;
  }>;
  rates: Record<string, unknown>;
  template_filled: string | null;
  vendor_email_draft: string | null;
}

export interface Approvals {
  intake_approved: boolean;
  scheduling_approved: boolean;
  invoice_approved: boolean;
}

export interface WorkOrder {
  id: string;
  status: WorkOrderStatus;
  raw_request: string;
  classification: Classification | null;
  schedule: Schedule | null;
  invoice: Invoice | null;
  approvals: Approvals;
  trace_id: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export function createWorkOrder(rawRequest: string): Promise<WorkOrder> {
  return request<WorkOrder>("/work-orders", {
    method: "POST",
    body: JSON.stringify({ raw_request: rawRequest }),
  });
}

export function getWorkOrder(id: string): Promise<WorkOrder> {
  return request<WorkOrder>(`/work-orders/${id}`);
}

export function approveStage(
  id: string,
  stage: "intake" | "scheduling" | "invoice",
): Promise<WorkOrder> {
  return request<WorkOrder>(`/work-orders/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ stage }),
  });
}

export function sendInvoiceMessage(
  id: string,
  message: string,
): Promise<{ reply: string; work_order: WorkOrder }> {
  return request<{ reply: string; work_order: WorkOrder }>(
    `/work-orders/${id}/invoice-chat`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
  );
}
