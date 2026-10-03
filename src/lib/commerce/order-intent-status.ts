// src/lib/commerce/order-intent-status.ts
/**
 * Locally-declared order-intent status allow-list (v4 plan step 2.6).
 *
 * Mirrors the storefront's canonical `OrderIntentStatus` union so the admin
 * console can reject arbitrary status strings now, without waiting for the
 * shared @mcdaves/shared package (step 3.3). The invented 'PAYMENT_PENDING'
 * value is deliberately absent — it was never a valid storefront status.
 */
export const ORDER_INTENT_STATUSES = [
  'NEW',
  'WHATSAPP_OPENED',
  'CONTACTED',
  'IN_CONVERSATION',
  'CONSULTATION',
  'AWAITING_CUSTOMER',
  'CONVERTED',
  'LOST',
  'CANCELLED',
] as const;

export type OrderIntentStatus = (typeof ORDER_INTENT_STATUSES)[number];

export function isOrderIntentStatus(value: unknown): value is OrderIntentStatus {
  return typeof value === 'string' && (ORDER_INTENT_STATUSES as readonly string[]).includes(value);
}
