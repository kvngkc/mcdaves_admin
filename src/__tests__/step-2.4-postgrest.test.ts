import { describe, it, expect } from 'vitest';
import { sanitizePostgrestSearch, buildOrIlikeFilter, likeTerm } from '@/lib/security/postgrest';

// Step 2.4 — Sanitise PostgREST search input.
// Verify: a search string containing commas, parentheses and dots is treated as
// literal text and cannot alter the column set or add operators.

describe('2.4 — PostgREST filter injection', () => {
  it('strips the injection metacharacters from the value', () => {
    const clean = sanitizePostgrestSearch('a,b(c).*\\d%');
    expect(clean).toBe('abcd');
    expect(clean).not.toMatch(/[%(),.*\\]/);
  });

  it('cannot add an extra column/operator via the search value', () => {
    expect(sanitizePostgrestSearch('x%,id.gt.0')).toBe('xidgt0');
  });

  it('builds the filter over ONLY the fixed column allow-list', () => {
    const cols = ['customer_name', 'customer_phone', 'product_name'] as const;
    const filter = buildOrIlikeFilter(cols, 'john');
    expect(filter).toBe('customer_name.ilike.%john%,customer_phone.ilike.%john%,product_name.ilike.%john%');
    for (const seg of (filter as string).split(',')) {
      expect(cols.some((c) => seg.startsWith(`${c}.ilike.`))).toBe(true);
    }
  });

  it('returns null for empty/blank searches (no filter applied)', () => {
    expect(buildOrIlikeFilter(['id'], '')).toBeNull();
    expect(buildOrIlikeFilter(['id'], '   ')).toBeNull();
    expect(buildOrIlikeFilter(['id'], null)).toBeNull();
  });

  it('neutralises quotes/backslashes so the value cannot close the operand', () => {
    expect(sanitizePostgrestSearch('a"b')).toBe('ab');
    expect(likeTerm('a"b')).toBe('%a\\"b%');
  });
});
