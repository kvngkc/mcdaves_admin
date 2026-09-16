// src/vto-lab/tracking/FaceTrackingTypes.ts
/**
 * Isolated domain types for the VTO Lab.
 * Zero dependency on McDaves core state.
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface HeadPose {
  translation: Point3D;
  pitch: number; // in radians
  yaw: number;   // in radians
  roll: number;  // in radians
  quaternion: [number, number, number, number]; // [x, y, z, w]
}

export interface LandmarkPoint {
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
  z: number; // relative depth
}

export interface FaceDetectionResult {
  /**
   * MediaPipe 4x4 facial transformation matrix.
   * 16-element Float32Array in column-major order.
   * Maps canonical face model (in cm) into metric camera space (cm).
   */
  faceMatrix: Float32Array | null;
  /** Normalized face landmarks (468 or 478 points). */
  rawLandmarks: LandmarkPoint[];
  /** Pixel landmarks for key facial anchors. */
  noseBridgePx: Point3D;
  leftPupilPx: Point3D;
  rightPupilPx: Point3D;
  ipdPixels: number;
  /** Estimated 6-DOF head pose decomposed from faceMatrix. */
  pose: HeadPose;
  /** Frame source dimensions. */
  videoWidth: number;
  videoHeight: number;
  /** Frame timestamp in ms. */
  timestamp: number;
  /** Detection confidence. */
  confidence: number;
}

export interface LetterboxViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export interface CameraState {
  stream: MediaStream | null;
  videoElement: HTMLVideoElement | null;
  videoWidth: number;
  videoHeight: number;
  isStreaming: boolean;
  isLoading: boolean;
  error: Error | null;
}

export type VTOActiveModel = 'axes' | 'cube' | 'glasses' | 'none';

export interface VTOControlState {
  activeModel: VTOActiveModel;
  showLandmarks2D: boolean;
  showAxes: boolean;
  showCube: boolean;
  showGlasses: boolean;
  mirrorPresentation: boolean;
  debugOverlay: boolean;
  selectedGlb: string;
  frameSize: string;
  fovDegrees: number;
  showHeadOcclusion: boolean;
  debugOccluderMesh: boolean;
}

export interface ModelMeasurement {
  min: Point3D;
  max: Point3D;
  size: Point3D;
  center: Point3D;
  nativeWidth: number;
  nativeHeight: number;
  nativeDepth: number;
}
