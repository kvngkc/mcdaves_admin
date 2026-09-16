// src/vto-lab/tracking/FaceLandmarker.ts
/**
 * MediaPipe Face Landmarker Engine for VTO Lab.
 * Configured in VIDEO mode with 6-DOF metric transformation matrix output.
 */

import { Matrix4, Euler, Quaternion, Vector3 } from 'three';
import {
  FaceDetectionResult,
  HeadPose,
  LandmarkPoint,
  Point3D,
} from './FaceTrackingTypes';

const MODEL_PATH = '/models/face_landmarker.task';
const LOCAL_WASM_PATH = '/wasm';
const CDN_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

interface FaceLandmarkerRawOutput {
  faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  facialTransformationMatrixes?: Array<{ data: number[] | Float32Array }>;
}

interface FaceLandmarkerInstance {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): FaceLandmarkerRawOutput;
  close?: () => void;
}

let landmarkerPromise: Promise<FaceLandmarkerInstance> | null = null;
let landmarkerInstance: FaceLandmarkerInstance | null = null;

export async function initFaceLandmarker(): Promise<FaceLandmarkerInstance> {
  if (landmarkerInstance) return landmarkerInstance;
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks(LOCAL_WASM_PATH);
    } catch {
      vision = await FilesetResolver.forVisionTasks(CDN_WASM_PATH);
    }

    const baseOptions = {
      runningMode: 'VIDEO' as const,
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    };

    try {
      const instance = (await FaceLandmarker.createFromOptions(vision, {
        ...baseOptions,
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: 'GPU',
        },
      })) as unknown as FaceLandmarkerInstance;

      landmarkerInstance = instance;
      return instance;
    } catch (gpuErr) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[VTO-Lab] GPU delegate failed; falling back to CPU.', gpuErr);
      }

      const instance = (await FaceLandmarker.createFromOptions(vision, {
        ...baseOptions,
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: 'CPU',
        },
      })) as unknown as FaceLandmarkerInstance;

      landmarkerInstance = instance;
      return instance;
    }
  })();

  return landmarkerPromise;
}

export function closeFaceLandmarker(): void {
  landmarkerInstance?.close?.();
  landmarkerInstance = null;
  landmarkerPromise = null;
}

export function decomposeTransformationMatrix(matrixData: Float32Array): HeadPose {
  const m = new Matrix4().fromArray(matrixData);
  const pos = new Vector3();
  const quat = new Quaternion();
  const scale = new Vector3();
  m.decompose(pos, quat, scale);

  const euler = new Euler().setFromQuaternion(quat, 'YXZ');

  return {
    translation: { x: pos.x, y: pos.y, z: pos.z },
    pitch: euler.x,
    yaw: euler.y,
    roll: euler.z,
    quaternion: [quat.x, quat.y, quat.z, quat.w],
  };
}

export function processFaceLandmarks(
  rawOutput: FaceLandmarkerRawOutput,
  videoWidth: number,
  videoHeight: number,
  timestampMs: number,
): FaceDetectionResult | null {
  const landmarks = rawOutput.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;

  // Key landmark indices:
  // 168: Nose bridge / Sellion
  // 468: Left iris / pupil center (or 33 left outer corner)
  // 473: Right iris / pupil center (or 263 right outer corner)
  const nose = landmarks[168] ?? landmarks[6];
  const leftPupil = landmarks[468] ?? landmarks[33];
  const rightPupil = landmarks[473] ?? landmarks[263];

  if (!nose || !leftPupil || !rightPupil) return null;

  const toPx = (p: { x: number; y: number; z: number }): Point3D => ({
    x: p.x * videoWidth,
    y: p.y * videoHeight,
    z: p.z * videoWidth,
  });

  const noseBridgePx = toPx(nose);
  const leftPupilPx = toPx(leftPupil);
  const rightPupilPx = toPx(rightPupil);
  const ipdPixels = Math.hypot(
    rightPupilPx.x - leftPupilPx.x,
    rightPupilPx.y - leftPupilPx.y,
  );

  const matrixRaw = rawOutput.facialTransformationMatrixes?.[0]?.data;
  const faceMatrix = matrixRaw ? new Float32Array(matrixRaw) : null;

  const pose = faceMatrix
    ? decomposeTransformationMatrix(faceMatrix)
    : {
      translation: { ...noseBridgePx },
      pitch: 0,
      yaw: 0,
      roll: Math.atan2(
        rightPupilPx.y - leftPupilPx.y,
        rightPupilPx.x - leftPupilPx.x,
      ),
      quaternion: [0, 0, 0, 1] as [number, number, number, number],
    };

  const rawLandmarks: LandmarkPoint[] = landmarks.map((pt) => ({
    x: pt.x,
    y: pt.y,
    z: pt.z,
  }));

  return {
    faceMatrix,
    rawLandmarks,
    noseBridgePx,
    leftPupilPx,
    rightPupilPx,
    ipdPixels,
    pose,
    videoWidth,
    videoHeight,
    timestamp: timestampMs,
    confidence: 1.0,
  };
}
