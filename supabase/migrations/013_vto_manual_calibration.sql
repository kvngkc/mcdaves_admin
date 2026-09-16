-- VTO ownership migration: admin is the sole authoring authority.
-- Uploaded GLB remains the production GLB. Calibration is metadata only.
ALTER TABLE public.vto_asset_calibrations ADD COLUMN IF NOT EXISTS manual_transform JSONB NOT NULL DEFAULT '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":1}'::jsonb;
ALTER TABLE public.vto_asset_calibrations DROP CONSTRAINT IF EXISTS vto_asset_calibrations_published_derivative_check;
ALTER TABLE public.vto_asset_calibrations DROP CONSTRAINT IF EXISTS vto_asset_calibrations_published_check;
ALTER TABLE public.vto_asset_calibrations DROP CONSTRAINT IF EXISTS vto_asset_calibrations_manual_transform_check;
ALTER TABLE public.vto_asset_calibrations ADD CONSTRAINT vto_asset_calibrations_manual_transform_check CHECK (
  jsonb_typeof(manual_transform)='object'
  AND jsonb_typeof(manual_transform->'position')='object'
  AND jsonb_typeof(manual_transform->'rotation')='object'
  AND jsonb_typeof(manual_transform->'scale')='number'
  AND (manual_transform->>'scale')::numeric > 0
);

-- Publication is one database transaction: variant linkage and VTO publication
-- either both commit or neither does.
CREATE OR REPLACE FUNCTION public.publish_vto_asset(p_asset_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset public.vto_asset_calibrations%ROWTYPE;
  v_variant_id text;
  v_now timestamptz := now();
  v_url text;
BEGIN
  SELECT * INTO v_asset
  FROM public.vto_asset_calibrations
  WHERE asset_id = p_asset_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'VTO asset not found'; END IF;
  IF v_asset.status <> 'APPROVED' THEN RAISE EXCEPTION 'VTO asset must be APPROVED before publication'; END IF;
  IF v_asset.storage_path IS NULL OR v_asset.storage_path = '' THEN RAISE EXCEPTION 'Production GLB storage path is missing'; END IF;
  IF v_asset.manual_transform IS NULL OR (v_asset.manual_transform->>'scale')::numeric <= 0 THEN RAISE EXCEPTION 'Valid manual calibration is required'; END IF;

  v_variant_id := NULLIF(v_asset.provenance->>'variantId', '');
  IF v_variant_id IS NULL THEN RAISE EXCEPTION 'Variant linkage evidence is missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id) THEN
    RAISE EXCEPTION 'Variant % not found', v_variant_id;
  END IF;

  v_url := COALESCE(v_asset.vto_glb_url, '');
  IF v_url = '' THEN
    v_url := format('%s/storage/v1/object/public/%s/%s',
      current_setting('app.settings.supabase_url', true),
      COALESCE(v_asset.storage_bucket, 'vto-models'),
      v_asset.storage_path);
  END IF;

  UPDATE public.product_variants
  SET vto_asset_id = p_asset_id, updated_at = v_now
  WHERE id = v_variant_id;

  UPDATE public.vto_asset_calibrations
  SET status = 'PUBLISHED',
      vto_glb_url = v_url,
      storage_bucket = COALESCE(storage_bucket, 'vto-models'),
      source_storage_path = storage_path,
      provenance = COALESCE(provenance, '{}'::jsonb) || jsonb_build_object(
        'productionPath', storage_path,
        'publishedAt', v_now,
        'publishedFrom', 'manual-calibration'
      ),
      updated_at = v_now
  WHERE asset_id = p_asset_id;

  RETURN jsonb_build_object('assetId', p_asset_id, 'variantId', v_variant_id, 'status', 'PUBLISHED', 'vtoGlbUrl', v_url);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_vto_asset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_vto_asset(text) TO service_role;
