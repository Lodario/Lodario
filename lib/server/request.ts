import 'server-only';
import { randomUUID } from 'node:crypto';

export type SafeServerEvent =
  | 'account_export_failed'
  | 'account_deletion_failed'
  | 'feedback_delivery_failed'
  | 'health_check_failed';

export function createRequestId(): string {
  return randomUUID();
}

export function safeServerError(event: SafeServerEvent, requestId: string, status: number): void {
  console.error(`[${event}] request_id=${requestId} status=${status}`);
}
