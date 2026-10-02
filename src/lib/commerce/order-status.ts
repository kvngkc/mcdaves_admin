// src/lib/commerce/order-status.ts
/**
 * Canonical order-intent status vocabulary (Step 3.3, v4 plan).
 *
 * Declared identically in both repos; both sides validate against it. The set
 * is the union of the two previously-divergent vocabularies, so no legitimate
 * state is lost and dual-acceptance is inherent during the rollout window.
 */

import { z } from 'zod';

export const ORDER_INTENT_STATUSES = [
  'NEW',
  'WHATSAPP_OPENED',
  'CONTACTED',
  'IN_CONVERSATION',
  'CONSULTATION',
  'AWAITING_CUSTOMER',
  'PAYMENT_PENDING',
  'CONVERTED',
  'LOST',
  'CANCELLED',
] as const;

export type OrderIntentStatus = (typeof ORDER_INTENT_STATUSES)[number];

export const OrderIntentStatusSchema = z.enum(ORDER_INTENT_STATUSES);

export function isOrderIntentStatus(value: unknown): value is OrderIntentStatus {
  return (
    typeof value === 'string' &&
    (ORDER_INTENT_STATUSES as readonly string[]).includes(value)
  );
}
