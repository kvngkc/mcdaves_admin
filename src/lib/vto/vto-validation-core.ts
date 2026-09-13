// src/lib/vto/vto-validation-core.ts
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import crypto from 'node:crypto';

// The client submits this structure (untrusted)
export interface ClientAssetCalibrationEvidence {
  assetId: string;
  name: string;
  physicalDimensions: {
    frameWidthMm: number | null;
    lensWidthMm: number | null;
    bridgeWidthMm: number | null;
    templeLengthMm: number | null;
  };
  registration: {
    bridge: { x: number | null; y: number | null; z: number | null };
    measuredNativeWidth: number;
    widthMultiplier: number;
    rotationOffsetEuler: { x: number; y: number; z: number };
    pantoscopicTilt: number;
  };
  orientation: {
    forward: string;
    up: string;
    handedness: string;
  };
  templeProcessing: any;
  versioning: any;
  paths: any;
}

export interface ValidationCoreResult {
  isValid: boolean;
  recommendedStatus: 'REVIEW_REQUIRED' | 'VALIDATION_FAILED' | 'CALIBRATION_FAILED' | 'PROCESSING_FAILED';
  failureReason?: string;
  contentHash: string;
  assetId: string;
}

const MAX_VERTICES = 150000;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function validateAssetConsistency(
  glbBuffer: Buffer,
  evidence: ClientAssetCalibrationEvidence
): Promise<ValidationCoreResult> {
  // 1. Calculate Content Hash (SHA-256)
  const hashSum = crypto.createHash('sha256');
  hashSum.update(glbBuffer);
  const contentHash = hashSum.digest('hex');

  // 2. Validate Buffer Size
  if (glbBuffer.length === 0) {
    return { isValid: false, recommendedStatus: 'VALIDATION_FAILED', failureReason: 'Buffer is empty', contentHash, assetId: evidence.assetId };
  }
  if (glbBuffer.length > MAX_FILE_SIZE) {
    return { isValid: false, recommendedStatus: 'VALIDATION_FAILED', failureReason: 'Buffer exceeds maximum size of 50MB', contentHash, assetId: evidence.assetId };
  }

  // 3. Parse GLB (Server-side, without DOM)
  const io = new NodeIO();
  let document;
  try {
    document = await io.readBinary(new Uint8Array(glbBuffer));
  } catch (err: any) {
    return { isValid: false, recommendedStatus: 'VALIDATION_FAILED', failureReason: `Failed to parse GLB: ${err.message}`, contentHash, assetId: evidence.assetId };
  }

  // 4. Structural Checks
  const root = document.getRoot();
  const meshes = root.listMeshes();
  if (meshes.length === 0) {
    return { isValid: false, recommendedStatus: 'VALIDATION_FAILED', failureReason: 'Model contains no meshes', contentHash, assetId: evidence.assetId };
  }

  // Count vertices
  let totalVertices = 0;
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) {
        totalVertices += pos.getCount();
      }
    }
  }

  if (totalVertices === 0) {
    return { isValid: false, recommendedStatus: 'VALIDATION_FAILED', failureReason: 'Model contains no vertices', contentHash, assetId: evidence.assetId };
  }

  if (totalVertices > MAX_VERTICES) {
    return { isValid: false, recommendedStatus: 'VALIDATION_FAILED', failureReason: `Model contains too many vertices (${totalVertices} > ${MAX_VERTICES})`, contentHash, assetId: evidence.assetId };
  }

  // 5. Dimension Consistency Check
  const scene = root.getDefaultScene() || root.listScenes()[0];
  if (!scene) {
    return { isValid: false, recommendedStatus: 'VALIDATION_FAILED', failureReason: 'Model contains no scenes', contentHash, assetId: evidence.assetId };
  }

  // Calculate actual bounding box using gltf-transform
  const bbox = getBounds(scene);
  const sizeX = bbox.max[0] - bbox.min[0];
  const sizeY = bbox.max[1] - bbox.min[1];
  const sizeZ = bbox.max[2] - bbox.min[2];

  if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0 || !isFinite(sizeX) || !isFinite(sizeY) || !isFinite(sizeZ)) {
    return { isValid: false, recommendedStatus: 'VALIDATION_FAILED', failureReason: 'Model bounds are invalid, zero, or non-finite', contentHash, assetId: evidence.assetId };
  }

  // The client evidence claims a specific measured native width.
  // We must verify the client's `measuredNativeWidth` is extremely close to the actual bounds X or Z size.
  // Because orientation might change which axis is the "width", we check if the declared width is close to ANY of the bounding dimensions.
  const declaredNativeWidth = evidence.registration?.measuredNativeWidth;
  if (!declaredNativeWidth || declaredNativeWidth <= 0) {
    return { isValid: false, recommendedStatus: 'CALIBRATION_FAILED', failureReason: 'Client evidence missing measuredNativeWidth', contentHash, assetId: evidence.assetId };
  }

  const matchesX = Math.abs(sizeX - declaredNativeWidth) < 0.001;
  const matchesY = Math.abs(sizeY - declaredNativeWidth) < 0.001;
  const matchesZ = Math.abs(sizeZ - declaredNativeWidth) < 0.001;

  if (!matchesX && !matchesY && !matchesZ) {
    return {
      isValid: false,
      recommendedStatus: 'CALIBRATION_FAILED',
      failureReason: `Client calibration evidence is structurally inconsistent with the mesh. Declared measuredNativeWidth (${declaredNativeWidth}) does not match actual geometry bounds [${sizeX.toFixed(3)}, ${sizeY.toFixed(3)}, ${sizeZ.toFixed(3)}].`,
      contentHash,
      assetId: evidence.assetId,
    };
  }

  // 6. Check Physical Constraints (Sanity check)
  const physicalWidthMm = evidence.physicalDimensions?.frameWidthMm;
  if (physicalWidthMm && (physicalWidthMm < 80 || physicalWidthMm > 250)) {
    return { isValid: false, recommendedStatus: 'CALIBRATION_FAILED', failureReason: 'Declared physical width is outside sane bounds (80mm - 250mm)', contentHash, assetId: evidence.assetId };
  }

  // If we reach here, the evidence is consistent with the physical mesh, and the mesh is safe.
  return {
    isValid: true,
    recommendedStatus: 'REVIEW_REQUIRED',
    contentHash,
    assetId: evidence.assetId,
  };
}
