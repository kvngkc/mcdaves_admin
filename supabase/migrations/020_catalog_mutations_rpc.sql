-- 020_catalog_mutations_rpc.sql
-- Step 5.3 (v4 plan) — make multi-step catalog mutations atomic.
--
-- Product delete removed media -> variants -> product as three separate calls,
-- and PATCH deleted all media before re-inserting. A mid-way failure orphaned
-- rows or lost media. Both now run inside a single Postgres function, i.e. one
-- transaction: either every statement commits or none does.
--
-- Forward-only and idempotent (CREATE OR REPLACE FUNCTION). No schema change.

CREATE OR REPLACE FUNCTION delete_product_cascade(p_product_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM product_media WHERE product_id = p_product_id;
  DELETE FROM product_variants WHERE product_id = p_product_id;
  DELETE FROM products WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION replace_product_media(p_product_id TEXT, p_media JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM product_media WHERE product_id = p_product_id;
  IF p_media IS NOT NULL AND jsonb_array_length(p_media) > 0 THEN
    INSERT INTO product_media (id, product_id, type, url, alt_text, is_primary, sort_order)
    SELECT
      COALESCE(m->>'id', 'med-' || p_product_id || '-' || (ord - 1)::text),
      p_product_id,
      COALESCE(m->>'type', 'front'),
      m->>'url',
      COALESCE(m->>'alt_text', ''),
      COALESCE((m->>'is_primary')::boolean, (ord = 1)),
      COALESCE((m->>'sort_order')::int, ord - 1)
    FROM jsonb_array_elements(p_media) WITH ORDINALITY AS t(m, ord);
  END IF;
END;
$$;
