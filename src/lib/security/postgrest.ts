// src/lib/security/postgrest.ts
/**
 * PostgREST filter-injection guard (v4 plan step 2.4).
 *
 * `search` comes straight from the query string and was previously interpolated
 * into `.or(`col.ilike.%${search}%`)`. PostgREST parses that grammar, so `,`
 * `(` `)` `.` `*` `\` let an attacker add operators/columns (filter injection).
 * We neutralise the metacharacters, then callers quote each term.
 */
const POSTGREST_METACHARACTERS = /[%(),.*\\'"`;:=<>!|&[\]{}]/g;

export function sanitizePostgrestSearch(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(POSTGREST_METACHARACTERS, '').trim();
}

/**
 * Build a quoted ilike term: `%<escaped>%`.
 * `"` and `\` are escaped for PostgREST's double-quoted value syntax, so the
 * value can never terminate the quote or introduce a new operator.
 */
export function likeTerm(sanitized: string): string {
  return `%${sanitized.replace(/["\\]/g, '\\$&')}%`;
}

/**
 * Build an `.or()` expression over a FIXED, caller-supplied column allow-list.
 * The columns are code constants; only the (sanitised, quoted) value is dynamic.
 */
export function buildOrIlikeFilter(columns: readonly string[], rawSearch: string | null | undefined): string | null {
  const clean = sanitizePostgrestSearch(rawSearch);
  if (!clean) return null;
  return columns.map((column) => `${column}.ilike.${likeTerm(clean)}`).join(',');
}
