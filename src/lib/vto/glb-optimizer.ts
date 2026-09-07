// src/lib/vto/glb-optimizer.ts
/**
 * Automated 3D GLB Eyewear Compression & Optimization Engine.
 * 
 * Pipeline:
 * 1. Parse raw binary GLB using @gltf-transform/core.
 * 2. Prune unused nodes, cameras, lights, and orphan materials.
 * 3. Dedup duplicate accessors, textures, and vertex buffers.
 * 4. Weld coincident vertices to clean up indices.
 * 5. Downscale & compress embedded 4K textures to 1024px WebP using sharp.
 * 6. Serialize into ultra-lightweight streaming GLB binary (<500 KB).
 */

import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, weld, resample, center } from '@gltf-transform/functions';

export interface OptimizationResult {
  optimizedBuffer: Buffer;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  savingsPercent: number;
  textureCount: number;
  meshCount: number;
}

export interface OptimizationOptions {
  maxTextureDimension?: number;
  textureQuality?: number;
}

export async function optimizeGlbBuffer(
  inputBuffer: Buffer,
  options: OptimizationOptions = {},
): Promise<OptimizationResult> {
  const originalSizeBytes = inputBuffer.length;
  const maxDim = options.maxTextureDimension || 1024;
  const quality = options.textureQuality || 82;

  const io = new NodeIO();
  const doc = await io.readBinary(new Uint8Array(inputBuffer));

  // 1. Structural Optimizations: Auto-center to origin, prune dead weight, dedup shared assets, weld vertices
  await doc.transform(
    center({ pivot: 'center' }),
    prune({ keepAttributes: false, keepLeaves: false }),
    dedup(),
    weld(),
    resample(),
  );

  const root = doc.getRoot();
  const textures = root.listTextures();
  const meshes = root.listMeshes();

  // 2. Texture Optimization: Downscale oversized 4K textures & convert to compressed WebP
  try {
    const sharp = (await import('sharp')).default;

    for (const texture of textures) {
      const imgBytes = texture.getImage();
      if (!imgBytes || imgBytes.length === 0) continue;

      try {
        let image = sharp(Buffer.from(imgBytes));
        const meta = await image.metadata();

        if (meta.width && meta.height) {
          if (meta.width > maxDim || meta.height > maxDim) {
            image = image.resize({
              width: maxDim,
              height: maxDim,
              fit: 'inside',
              withoutEnlargement: true,
            });
          }

          // Convert to WebP
          const webpBuffer = await image.webp({ quality }).toBuffer();
          texture.setImage(new Uint8Array(webpBuffer));
          texture.setMimeType('image/webp');
        }
      } catch (texErr) {
        console.warn('[GLB-Optimizer] Warning: Texture compression skipped for an individual texture:', texErr);
      }
    }
  } catch (sharpErr) {
    console.warn('[GLB-Optimizer] Warning: Sharp module unavailable; skipping texture compression:', sharpErr);
  }

  // 3. Serialize optimized GLB
  const outputUint8 = await io.writeBinary(doc);
  const optimizedBuffer = Buffer.from(outputUint8);
  const optimizedSizeBytes = optimizedBuffer.byteLength;

  const savingsPercent = originalSizeBytes > 0
    ? Number((((originalSizeBytes - optimizedSizeBytes) / originalSizeBytes) * 100).toFixed(1))
    : 0;

  return {
    optimizedBuffer,
    originalSizeBytes,
    optimizedSizeBytes,
    savingsPercent: Math.max(0, savingsPercent),
    textureCount: textures.length,
    meshCount: meshes.length,
  };
}
