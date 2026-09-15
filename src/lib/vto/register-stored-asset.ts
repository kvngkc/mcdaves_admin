import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import { supabase } from '@/lib/supabase/service';
import { validateAssetConsistency, ClientAssetCalibrationEvidence } from './vto-validation-core';
import crypto from 'node:crypto';

export interface RegisterStoredAssetInput { storagePath: string; evidence: ClientAssetCalibrationEvidence; clientValidationStatus?: string | null; tmpGlbUrl?: string | null; }

async function deriveNativeWidth(glbBuffer: Buffer): Promise<number> {
  const document = await new NodeIO().readBinary(new Uint8Array(glbBuffer));
  const scene = document.getRoot().getDefaultScene() || document.getRoot().listScenes()[0];
  if (!scene) throw new Error('Model contains no scenes');
  const bounds = getBounds(scene);
  const dimensions = [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]].filter((v) => Number.isFinite(v) && v > 0);
  if (!dimensions.length) throw new Error('Model bounds are invalid');
  return Math.max(...dimensions);
}

export async function registerStoredVtoAsset(input: RegisterStoredAssetInput) {
  if (!supabase) throw new Error('Supabase client not configured');
  const bucketName = 'vto-models';
  const { data: fileData, error: downloadError } = await supabase.storage.from(bucketName).download(input.storagePath);
  if (downloadError || !fileData) throw new Error(`Failed to read temporary VTO asset: ${downloadError?.message || 'object not found'}`);
  const glbBuffer = Buffer.from(await fileData.arrayBuffer());
  const measuredNativeWidth = await deriveNativeWidth(glbBuffer);
  const evidence: ClientAssetCalibrationEvidence = { ...input.evidence, registration: { ...input.evidence.registration, measuredNativeWidth } };
  const validationResult = await validateAssetConsistency(glbBuffer, evidence);
  const assetId = evidence.assetId;
  const baseName = evidence.name || 'Unknown Model';
  let derivedStatus = 'REVIEW_REQUIRED';
  let rejectionNotes: string | null = null;
  if (input.clientValidationStatus === 'FAIL') { derivedStatus = 'PROCESSING_FAILED'; rejectionNotes = 'Client AssetValidator rejected the asset.'; }
  else if (!validationResult.isValid) { derivedStatus = validationResult.recommendedStatus; rejectionNotes = `Server Validation Failed: ${validationResult.failureReason}`; }

  const { data: existingAsset } = await supabase.from('vto_asset_calibrations').select('id, asset_content_hash, status').eq('asset_id', assetId).maybeSingle();
  if (existingAsset?.asset_content_hash === validationResult.contentHash) { await cleanupTemporaryObject(input.storagePath, input.tmpGlbUrl); return { success: true, status: existingAsset.status, assetId, contentHash: validationResult.contentHash, message: 'VTO Asset already registered with identical contents.' }; }
  if (existingAsset && (existingAsset.status === 'APPROVED' || existingAsset.status === 'PUBLISHED')) throw new Error('Cannot overwrite an asset that is already APPROVED or PUBLISHED.');

  const storagePath = `opt_${assetId}_${validationResult.contentHash.substring(0, 8)}.glb`;
  const { data: uploadData, error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, glbBuffer, { contentType: 'model/gltf-binary', upsert: true });
  if (uploadError || !uploadData) throw new Error(`Storage upload failed: ${uploadError?.message || 'unknown error'}`);
  const { data: listData, error: listError } = await supabase.storage.from(bucketName).list(undefined, { search: storagePath });
  const uploadedObject = listData?.find((item) => item.name === storagePath);
  if (listError || !uploadedObject || uploadedObject.metadata?.size === 0) throw new Error('Storage verification failed: object not found or empty after upload.');
  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  const glbUrl = publicUrlData?.publicUrl;
  if (!glbUrl) throw new Error('Failed to generate public URL for storage object.');

  const dbRecord = { asset_id: assetId, name: baseName, status: derivedStatus, source_glb_url: evidence.paths?.sourceGlbUrl || glbUrl, vto_glb_url: glbUrl, storage_bucket: bucketName, storage_path: storagePath, asset_content_hash: validationResult.contentHash, physical_width_mm: evidence.physicalDimensions?.frameWidthMm || null, lens_width_mm: evidence.physicalDimensions?.lensWidthMm || null, bridge_width_mm: evidence.physicalDimensions?.bridgeWidthMm || null, pantoscopic_tilt: evidence.registration?.pantoscopicTilt ?? -12, bridge_x: evidence.registration?.bridge?.x ?? 0, bridge_y: evidence.registration?.bridge?.y ?? 0, bridge_z: evidence.registration?.bridge?.z ?? 0 };
  const dbResult = existingAsset ? await supabase.from('vto_asset_calibrations').update(dbRecord).eq('asset_id', assetId) : await supabase.from('vto_asset_calibrations').insert({ id: crypto.randomUUID(), ...dbRecord });
  if (dbResult.error) throw new Error(`Database registration failed: ${dbResult.error.message}`);
  await cleanupTemporaryObject(input.storagePath, input.tmpGlbUrl);
  return { success: derivedStatus === 'REVIEW_REQUIRED', status: derivedStatus, assetId, glbPath: glbUrl, contentHash: validationResult.contentHash, rejectionNotes, message: derivedStatus === 'REVIEW_REQUIRED' ? 'VTO Asset registered successfully and is awaiting review.' : 'VTO Asset was saved in a failed validation state.' };
}

async function cleanupTemporaryObject(storagePath: string, tmpGlbUrl?: string | null) { if (!supabase) return; const candidates = new Set<string>(); if (storagePath.startsWith('tmp_')) candidates.add(storagePath); if (tmpGlbUrl?.includes('/tmp_')) candidates.add(tmpGlbUrl.split('/').pop() || ''); const paths = [...candidates].filter(Boolean); if (paths.length) await supabase.storage.from('vto-models').remove(paths).catch(() => null); }