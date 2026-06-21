import * as Sentry from "@sentry/react";

export function setSentryWorkOrderContext(id: string, status: string): void {
  Sentry.setTag("work_order_id", id);
  Sentry.setTag("work_order_status", status);
}
