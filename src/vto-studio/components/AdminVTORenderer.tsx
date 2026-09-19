'use client';

/**
 * AdminVTORenderer — fills its parent div (inset-0 w-full h-full).
 *
 * Rendering modes
 * ───────────────
 * isOffsetMode = false (LEGACY)
 *   Behaviour identical to the original code: bridge offset is applied
 *   directly, transform.scale is used as-is, no bbox anchoring, no FIT_FACTOR.
 *   All existing calibrated assets render unchanged.
 *
 * isOffsetMode = true (AUTO-FIT)
 *   On model load:
 *     • Computes Box3 bounding box of the cloned GLB scene.
 *     • Derives anchor: X = bbox center, Y = bridge.y if bridgeSource='manual'
 *       else bbox center, Z = bbox.max.z (front face of frame).
 *     • Stores modelWidth for per-frame scale computation.
 *   Per frame:
 *     • Measures face width by transforming canonical landmarks 127 & 356 through
 *       the faceMatrix (Option A — metric camera space, same units as the GLB).
 *     • defaultScale = (faceWidth / modelWidth) * FIT_FACTOR
 *     • offsetMatrix scale = defaultScale * transform.scale
 *     • Composes faceMatrix * offsetMatrix so all manual values are local offsets.
 *
 * Regression fix (applied 2026-09-19):
 *   Manual position/rotation/scale are now applied as an offsetMatrix composed
 *   with faceMatrix (not added in world space), so Z moves forward/back along
 *   the nose and head rotation is fully tracked.
 */

import React, { Suspense, MutableRefObject, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Box3, Euler, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { FaceDetectionResult, ModelMeasurement } from '../tracking/FaceTrackingTypes';
import { StudioTransform, StudioBridge } from '../AdminVTOCalibrationStudio';
import { HeadOccluder } from './HeadOccluder';
import {
  CANONICAL_LANDMARK_127,
  CANONICAL_LANDMARK_356,
} from '../constants/faceMeshTriangulation';

// ── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_NOSE_BRIDGE = new Vector3(0, 1.921027, 3.436015);

/**
 * Scales defaultScale down slightly so glasses don't protrude past the
 * temple-to-temple span. Tune this if glasses consistently appear too large.
 */
const FIT_FACTOR = 0.92;

// ── Helpers ───────────────────────────────────────────────────────────────────

function metricPose(data: number[] | Float32Array, mirrored = true) {
  const matrix = new Matrix4().fromArray(data);
  const rawPos = new Vector3();
  const rawQuat = new Quaternion();
  const rawScale = new Vector3();
  matrix.decompose(rawPos, rawQuat, rawScale);

  const bridge = CANONICAL_NOSE_BRIDGE.clone().applyMatrix4(matrix);
  const euler = new Euler().setFromQuaternion(rawQuat, 'YXZ');
  const outEuler = new Euler(
    euler.x - (12 * Math.PI) / 180,
    mirrored ? -euler.y : euler.y,
    mirrored ? -euler.z : euler.z,
    'YXZ',
  );

  return {
    position: new Vector3(mirrored ? -bridge.x : bridge.x, bridge.y, bridge.z),
    quaternion: new Quaternion().setFromEuler(outEuler),
    /** Raw face matrix (used for HeadOccluder and face-width measurement). */
    rawMatrix: matrix,
  };
}

// ── AdminModel ────────────────────────────────────────────────────────────────

function AdminModel({
  glbUrl,
  transform,
  bridge,
  bridgeSource,
  isOffsetMode,
  detectionRef,
  faceMatrixRef,
  onModelMeasured,
}: {
  glbUrl: string;
  transform: StudioTransform;
  bridge: StudioBridge;
  bridgeSource: 'manual' | 'auto';
  isOffsetMode: boolean;
  detectionRef: MutableRefObject<FaceDetectionResult | null>;
  /** Shared ref written every frame so HeadOccluder uses the same transform. */
  faceMatrixRef: MutableRefObject<Matrix4 | null>;
  onModelMeasured?: (m: ModelMeasurement) => void;
}) {
  const { gl } = useThree();

  const gltf = useLoader(GLTFLoader, glbUrl, (loader) => {
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath('/basis/');
    ktx2.detectSupport(gl);
    (loader as GLTFLoader).setKTX2Loader(ktx2);
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const root = useRef<Group>(null);
  const model = useRef<Group>(null);

  // Bbox computed once per model load — stored in a ref to avoid re-renders.
  const bboxRef = useRef<{
    anchorX: number;
    anchorY: number;
    anchorZ: number;
    modelWidth: number;
  } | null>(null);

  useEffect(() => {
    const bbox = new Box3().setFromObject(sceneClone);
    const size = new Vector3();
    const center = new Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);

    const modelWidth = size.x;

    if (isOffsetMode) {
      // AUTO-FIT anchor
      const anchorX = center.x;
      // Use manual bridge Y if it was explicitly set, else bbox center
      const anchorY = bridgeSource === 'manual' && bridge.y !== 0 ? bridge.y : center.y;
      const anchorZ = bbox.max.z; // front face of the frame

      bboxRef.current = { anchorX, anchorY, anchorZ, modelWidth };

      if (onModelMeasured) {
        onModelMeasured({
          min: { x: bbox.min.x, y: bbox.min.y, z: bbox.min.z },
          max: { x: bbox.max.x, y: bbox.max.y, z: bbox.max.z },
          size: { x: size.x, y: size.y, z: size.z },
          center: { x: center.x, y: center.y, z: center.z },
          nativeWidth: size.x,
          nativeHeight: size.y,
          nativeDepth: size.z,
        });
      }
    } else {
      // LEGACY: store modelWidth only; anchor is the raw bridge offset.
      bboxRef.current = {
        anchorX: bridge.x,
        anchorY: bridge.y,
        anchorZ: bridge.z,
        modelWidth,
      };
    }
  // Re-run if the model, mode, or bridge changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneClone, isOffsetMode, bridgeSource, bridge.x, bridge.y, bridge.z]);

  useFrame(() => {
    if (!root.current || !model.current) return;
    const detection = detectionRef.current;

    if (!detection?.faceMatrix) {
      root.current.visible = false;
      faceMatrixRef.current = null;
      return;
    }

    const pose = metricPose(detection.faceMatrix, true);

    // Build face matrix (position + rotation only — scale = 1).
    const faceMatrix = new Matrix4().compose(
      pose.position,
      pose.quaternion,
      new Vector3(1, 1, 1),
    );

    // Publish for HeadOccluder.
    faceMatrixRef.current = faceMatrix;

    const bbox = bboxRef.current;

    // ── LEGACY PATH ──────────────────────────────────────────────────────────
    if (!isOffsetMode || !bbox) {
      const manualRotation = new Quaternion().setFromEuler(
        new Euler(
          (transform.rotation.x * Math.PI) / 180,
          (transform.rotation.y * Math.PI) / 180,
          (transform.rotation.z * Math.PI) / 180,
          'YXZ',
        ),
      );

      const offsetMatrix = new Matrix4().compose(
        new Vector3(transform.position.x, transform.position.y, transform.position.z),
        manualRotation,
        new Vector3(transform.scale, transform.scale, transform.scale),
      );

      const finalMatrix = faceMatrix.clone().multiply(offsetMatrix);
      root.current.visible = true;
      finalMatrix.decompose(root.current.position, root.current.quaternion, root.current.scale);

      // Legacy bridge offset applied to inner model group.
      model.current.position.set(-bridge.x, -bridge.y, -bridge.z);
      return;
    }

    // ── AUTO-FIT PATH ────────────────────────────────────────────────────────

    // Compute face width (Option A): transform canonical temple landmarks through
    // the face matrix to get metric camera-space positions, then measure distance.
    const p127 = CANONICAL_LANDMARK_127.clone().applyMatrix4(faceMatrix);
    const p356 = CANONICAL_LANDMARK_356.clone().applyMatrix4(faceMatrix);
    const faceWidth = p127.distanceTo(p356);

    // Guard against degenerate values (face not fully visible, etc.)
    const defaultScale =
      faceWidth > 0.1 && bbox.modelWidth > 0.001
        ? (faceWidth / bbox.modelWidth) * FIT_FACTOR
        : transform.scale;

    const manualRotation = new Quaternion().setFromEuler(
      new Euler(
        (transform.rotation.x * Math.PI) / 180,
        (transform.rotation.y * Math.PI) / 180,
        (transform.rotation.z * Math.PI) / 180,
        'YXZ',
      ),
    );

    // transform.scale acts as a multiplier on top of auto-fit scale.
    const finalScale = defaultScale * transform.scale;

    const offsetMatrix = new Matrix4().compose(
      new Vector3(transform.position.x, transform.position.y, transform.position.z),
      manualRotation,
      new Vector3(finalScale, finalScale, finalScale),
    );

    const finalMatrix = faceMatrix.clone().multiply(offsetMatrix);
    root.current.visible = true;
    finalMatrix.decompose(root.current.position, root.current.quaternion, root.current.scale);

    // Auto-fit anchor applied to inner model group.
    model.current.position.set(-bbox.anchorX, -bbox.anchorY, -bbox.anchorZ);
  });

  return (
    <group ref={root} visible={false}>
      <group ref={model}>
        <primitive object={sceneClone} />
      </group>
    </group>
  );
}

// ── Public props ──────────────────────────────────────────────────────────────

export interface AdminVTORendererProps {
  glbUrl: string;
  bridge: StudioBridge;
  bridgeSource: 'manual' | 'auto';
  transform: StudioTransform;
  isOffsetMode: boolean;
  detectionRef: MutableRefObject<FaceDetectionResult | null>;
  showHeadOcclusion?: boolean;
  debugOccluderMesh?: boolean;
  fovDegrees?: number;
  onModelMeasured?: (m: ModelMeasurement) => void;
}

// ── Canvas wrapper ────────────────────────────────────────────────────────────

export function AdminVTORenderer({
  glbUrl,
  bridge,
  bridgeSource,
  transform,
  isOffsetMode,
  detectionRef,
  showHeadOcclusion = false,
  debugOccluderMesh = false,
  fovDegrees = 63.0,
  onModelMeasured,
}: AdminVTORendererProps) {
  // Shared mutable ref: AdminModel writes the faceMatrix each frame;
  // HeadOccluder reads it. This avoids prop-drilling a Matrix4 through React state.
  const faceMatrixRef = useRef<Matrix4 | null>(null);

  return (
    <Canvas
      camera={{ position: [0, 0, 0], fov: fovDegrees }}
      gl={{ alpha: true, antialias: true, sortObjects: false }}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <ambientLight intensity={1} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <directionalLight position={[-3, 2, 3]} intensity={0.6} />

      {/* Occluder rendered before glasses (renderOrder = -1) */}
      {(showHeadOcclusion || debugOccluderMesh) && (
        <HeadOccluder
          detectionRef={detectionRef}
          faceMatrix={faceMatrixRef}
          debugOccluderMesh={debugOccluderMesh}
        />
      )}

      {glbUrl && (
        <Suspense fallback={null}>
          <AdminModel
            glbUrl={glbUrl}
            bridge={bridge}
            bridgeSource={bridgeSource}
            isOffsetMode={isOffsetMode}
            transform={transform}
            detectionRef={detectionRef}
            faceMatrixRef={faceMatrixRef}
            onModelMeasured={onModelMeasured}
          />
        </Suspense>
      )}
    </Canvas>
  );
}

export default AdminVTORenderer;
