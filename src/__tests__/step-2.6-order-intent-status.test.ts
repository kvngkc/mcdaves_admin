import { describe, it, expect } from 'vitest';
import { ORDER_INTENT_STATUSES, isOrderIntentStatus } from '@/lib/commerce/order-intent-status';

// Step 2.6 — Validate the order-intent status field.
// Verify: a PATCH with an arbitrary status string is rejected; every accepted
// value exists in the canonical set.

describe('2.6 — order-intent status allow-list', () => {
  it('accepts every canonical storefront status', () => {
    for (const status of ORDER_INTENT_STATUSES) expect(isOrderIntentStatus(status)).toBe(true);
  });

  it('rejects the invented PAYMENT_PENDING value', () => {
    expect(isOrderIntentStatus('PAYMENT_PENDING')).toBe(false);
  });

  it('rejects arbitrary / injection-style status strings', () => {
    for (const bad of ['', 'paid', 'DELIVERED', "NEW'); DROP TABLE order_intents;--", 42, null, undefined]) {
      expect(isOrderIntentStatus(bad)).toBe(false);
    }
  });

  it('the accepted set matches the storefront canonical enum exactly', () => {
    expect([...ORDER_INTENT_STATUSES]).toEqual([
      'NEW', 'WHATSAPP_OPENED', 'CONTACTED', 'IN_CONVERSATION', 'CONSULTATION',
      'AWAITING_CUSTOMER', 'CONVERTED', 'LOST', 'CANCELLED',
    ]);
  });
});
