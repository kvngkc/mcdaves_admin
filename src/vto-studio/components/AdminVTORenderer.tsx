'use client';

/**
 * AdminVTORenderer
 * ─────────────────
 * Three.js Canvas overlay for the Admin Calibration Studio.
 *
 * Key design decisions:
 *  - Uses useLoader(GLTFLoader, url, configurator) instead of useGLTF so we
 *    can attach a KTX2Loader to the exact loader instance that processes the
 *    GLB.  useGLTF's internal loader is a separate instance and has no hook
 *    for KTX2 registration, which caused the "setKTX2Loader must be called
 *    before loading KTX2 textures" crash for Meshy-AI GLBs.
 *  - Basis transcoder is served from /basis/ (copied from three/examples/jsm/libs/basis).
 */

import React, { Suspense, MutableRefObject, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { Euler, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { FaceDetectionResult, LetterboxViewport } from '../tracking/FaceTrackingTypes';
import { StudioTransform, StudioBridge } from '../AdminVTOCalibrationStudio';

const CANONICAL_NOSE_BRIDGE = new Vector3(0, 1.921027, 3.436015);

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
    'YXZ'
  );

  return {
    position: new Vector3(mirrored ? -bridge.x : bridge.x, bridge.y, bridge.z),
    quaternion: new Quaternion().setFromEuler(outEuler),
  };
}

function AdminModel({
  glbUrl,
  transform,
  bridge,
  detectionRef,
}: {
  glbUrl: string;
  transform: StudioTransform;
  bridge: StudioBridge;
  detectionRef: MutableRefObject<FaceDetectionResult | null>;
}) {
  const { gl } = useThree();

  // Use useLoader with a configurator so the KTX2Loader is registered on the
  // exact GLTFLoader instance that processes this GLB.
  const gltf = useLoader(GLTFLoader, glbUrl, (loader) => {
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath('/basis/');
    ktx2.detectSupport(gl);
    (loader as GLTFLoader).setKTX2Loader(ktx2);
  });

  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const root = useRef<Group>(null);
  const model = useRef<Group>(null);

  useFrame(() => {
    if (!root.current || !model.current) return;
    const detection = detectionRef.current;
    if (!detection || !detection.faceMatrix) {
      root.current.visible = false;
      return;
    }

    const pose = metricPose(detection.faceMatrix, true);
    const manualRotation = new Quaternion().setFromEuler(
      new Euler(
        (transform.rotation.x * Math.PI) / 180,
        (transform.rotation.y * Math.PI) / 180,
        (transform.rotation.z * Math.PI) / 180,
        'YXZ'
      )
    );

    root.current.visible = true;
    root.current.position.set(
      pose.position.x + transform.position.x,
      pose.position.y + transform.position.y,
      pose.position.z + transform.position.z
    );
    root.current.quaternion.copy(pose.quaternion).multiply(manualRotation);
    root.current.scale.setScalar(transform.scale);
    model.current.position.set(-bridge.x, -bridge.y, -bridge.z);
  });

  return (
    <group ref={root} visible={false}>
      <group ref={model}>
        <primitive object={sceneClone} />
      </group>
    </group>
  );
}

export interface AdminVTORendererProps {
  viewport: LetterboxViewport;
  glbUrl: string;
  bridge: StudioBridge;
  transform: StudioTransform;
  detectionRef: MutableRefObject<FaceDetectionResult | null>;
  fovDegrees?: number;
}

export function AdminVTORenderer({
  viewport,
  glbUrl,
  bridge,
  transform,
  detectionRef,
  fovDegrees = 63.0,
}: AdminVTORendererProps) {
  return (
    <div
      className="absolute overflow-hidden pointer-events-none z-10"
      style={{
        left: viewport.left,
        top: viewport.top,
        width: viewport.width,
        height: viewport.height,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 0], fov: fovDegrees }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <ambientLight intensity={1} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-3, 2, 3]} intensity={0.6} />

        {glbUrl && (
          <Suspense fallback={null}>
            <AdminModel
              glbUrl={glbUrl}
              bridge={bridge}
              transform={transform}
              detectionRef={detectionRef}
            />
          </Suspense>
        )}
      </Canvas>
    </div>
  );
}

export default AdminVTORenderer;
