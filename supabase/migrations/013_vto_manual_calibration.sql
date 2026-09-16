-- VTO ownership migration: admin is the sole authoring authority.
-- Uploaded GLB remains the production GLB. Calibration is metadata only.
ALTER TABLE public.vto_asset_calibrations ADD COLUMN IF NOT EXISTS manual_transform JSONB NOT NULL DEFAULT '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":1}'::jsonb;
ALTER TABLE public.vto_asset_calibrations DROP CONSTRAINT IF EXISTS vto_asset_calibrations_published_derivative_check;
ALTER TABLE public.vto_asset_calibrations DROP CONSTRAINT IF EXISTS vto_asset_calibrations_published_check;
ALTER TABLE public.vto_asset_calibrations ADD CONSTRAINT vto_asset_calibrations_manual_transform_check CHECK (jsonb_typeof(manual_transform)='object' AND jsonb_typeof(manual_transform->'position')='object' AND jsonb_typeof(manual_transform->'rotation')='object' AND jsonb_typeof(manual_transform->'scale')='number' AND (manual_transform->>'scale')::numeric > 0);
