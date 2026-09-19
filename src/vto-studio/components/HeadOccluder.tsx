'use client';

/**
 * HeadOccluder — invisible depth-mask mesh built from the MediaPipe 468-landmark face mesh.
 *
 * Purpose: writes depth but no colour. When rendered before the glasses (renderOrder = -1),
 * it ensures the temples disappear behind the ears/cheeks, because Three.js depth-testing
 * will reject glass fragments that are "behind" the face.
 *
 * Key design constraints (from MCD-DEC-010):
 *  - Must share the exact same coordinate transform as the glasses (faceMatrix prop).
 *  - colorWrite: false → invisible in the colour buffer.
 *  - depthWrite: true  → writes into the depth buffer.
 *  - renderOrder = -1  → renders before glasses (default renderOrder = 0).
 *  - Slightly scaled inward so the front-frame edge stays visible.
 */

import React, { useRef, useMemo, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  Matrix4,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { FaceDetectionResult } from '../tracking/FaceTrackingTypes';
import { FACE_MESH_TRIANGULATION } from '../constants/faceMeshTriangulation';

// ── Named constants ──────────────────────────────────────────────────────────

/**
 * Uniform scale applied to the occluder to pull it slightly inward.
 * < 1 shrinks the mesh so the very front of the glasses frames remain visible.
 */
const OCCLUDER_SCALE_FIT = 0.95;

/**
 * Z-axis offset (in cm, metric camera space) applied to push the occluder mesh
 * slightly behind the face surface. Prevents the depth mask from clipping the
 * front face of the glass frames.
 */
const OCCLUDER_Z_OFFSET = -0.15;

// ── Types ────────────────────────────────────────────────────────────────────

interface HeadOccluderProps {
  detectionRef: MutableRefObject<FaceDetectionResult | null>;
  /** The same face transform matrix used to position the glasses. */
  faceMatrix: MutableRefObject<Matrix4 | null>;
  /** When true, renders the mesh visibly (green wireframe) for alignment debugging. */
  debugOccluderMesh?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function HeadOccluder({
  detectionRef,
  faceMatrix,
  debugOccluderMesh = false,
}: HeadOccluderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Build geometry once; we'll update vertex positions every frame.
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    // Preallocate 468 landmarks × 3 components
    const positions = new Float32Array(468 * 3);
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setIndex(new Uint16BufferAttribute(new Uint16Array(FACE_MESH_TRIANGULATION), 1));
    return geo;
  }, []);

  // Normal (invisible depth-mask) material
  const normalMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        colorWrite: false,
        depthWrite: true,
        side: 2, // THREE.DoubleSide
      }),
    [],
  );

  // Debug material — semi-transparent green wireframe
  const debugMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0x00ff88,
        opacity: 0.35,
        transparent: true,
        wireframe: true,
        side: 2, // THREE.DoubleSide
      }),
    [],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const detection = detectionRef.current;
    const fm = faceMatrix.current;

    if (!detection || !detection.rawLandmarks || detection.rawLandmarks.length < 468 || !fm) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    mesh.material = debugOccluderMesh ? debugMaterial : normalMaterial;

    // Convert each normalized landmark into metric camera space via the faceMatrix,
    // then apply the inward scale + Z offset.
    //
    // MediaPipe rawLandmarks are normalized [0,1] in image space. To convert
    // to metric camera space, we apply the faceMatrix which maps the canonical
    // face model (cm) into camera space. The normalized landmarks correspond
    // to the canonical face model's vertex positions after division by the face
    // model's reference size (~18 cm face width). So we scale them back up
    // by the canonical reference and apply the faceMatrix.
    //
    // In practice: we transform each landmark's local-space position (derived
    // from the canonical model via faceMatrix) and apply OCCLUDER_SCALE_FIT.

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const posArray = positions.array as Float32Array;

    // The faceMatrix already encodes position, rotation, and uniform scale of
    // the face in camera space. We use it directly to transform canonical model
    // landmark coordinates. For a rough occluder, we can use the raw normalized
    // landmarks rescaled to canonical model range, but a more accurate approach
    // is to use the faceMatrix decomposed scale and apply normalized coords.

    // Practical approach: decompose faceMatrix to get the scale factor, then
    // treat rawLandmarks as offsets in canonical-model-scale space.
    const tmpPos = new Vector3();
    const tmpScale = new Vector3();
    const occluderMatrix = fm.clone();

    // Apply OCCLUDER_SCALE_FIT uniformly by scaling the matrix
    occluderMatrix.decompose(tmpPos, new (require('three').Quaternion)(), tmpScale);

    for (let i = 0; i < 468; i++) {
      const lm = detection.rawLandmarks[i];
      if (!lm) continue;

      // rawLandmarks are normalized [0,1]. MediaPipe's face mesh canonical
      // model has an approximate face width of ~18 cm at its reference scale.
      // Convert to local canonical face model space (cm), then transform via faceMatrix.
      // Normalize → canonical-model coords: multiply by canonical face extent.
      // The canonical model sits roughly in [-9, 9] X, [-9, 9] Y, [-6, 8] Z.
      // Rather than reconstructing the full inverse mapping, we use the known
      // faceMatrix to place each landmark at its in-scene metric position by
      // transforming the canonical 3D coordinates directly.

      // NOTE: rawLandmarks are normalized image-plane coords (x, y: 0-1, z: relative depth).
      // We use them as a proxy for the face mesh shape via the following mapping:
      //   x_local = (lm.x - 0.5) * 18   (rescale to ±9 cm, face model width)
      //   y_local = -(lm.y - 0.5) * 18  (flip Y: image Y is down, model Y is up)
      //   z_local = -lm.z * 18          (z is relative depth, negative = back)
      const xL = (lm.x - 0.5) * 18 * OCCLUDER_SCALE_FIT;
      const yL = -(lm.y - 0.5) * 18 * OCCLUDER_SCALE_FIT;
      const zL = -lm.z * 18 * OCCLUDER_SCALE_FIT + OCCLUDER_Z_OFFSET;

      tmpPos.set(xL, yL, zL);
      tmpPos.applyMatrix4(fm);

      posArray[i * 3] = tmpPos.x;
      posArray[i * 3 + 1] = tmpPos.y;
      posArray[i * 3 + 2] = tmpPos.z;
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={normalMaterial}
      renderOrder={-1}
      visible={false}
    />
  );
}

export default HeadOccluder;
