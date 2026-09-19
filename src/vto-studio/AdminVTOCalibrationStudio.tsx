'use client';

/**
 * AdminVTOCalibrationStudio — Simplified Architecture
 *
 * Camera feed + 3D overlay both use simple absolute-fill layout (inset-0 w-full h-full).
 * This avoids the letterbox math that was causing the video to be clipped before
 * ResizeObserver fired with real container dimensions.
 *
 * Modes
 * ─────
 * isOffsetMode = false (LEGACY):
 *   Manual position/rotation/scale are applied directly, exactly as before.
 *   No bbox anchoring, no FIT_FACTOR. Legacy calibrated assets render unchanged.
 *
 * isOffsetMode = true (AUTO-FIT):
 *   Glasses are auto-scaled to match the detected face width each frame.
 *   transform.position / rotation are local offsets on top of the auto-fit.
 *   transform.scale is a multiplier (1.0 = exactly auto-fit size).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useCameraController } from './camera/CameraController';
import { initFaceLandmarker, processFaceLandmarks } from './tracking/FaceLandmarker';
import { FaceDetectionResult, ModelMeasurement } from './tracking/FaceTrackingTypes';

const AdminVTORenderer = dynamic(() => import('./components/AdminVTORenderer'), {
  ssr: false,
});

// ── Exported types ────────────────────────────────────────────────────────────

export type StudioTransform = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
};

export type StudioBridge = { x: number; y: number; z: number };

export type BridgeSource = 'manual' | 'auto';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TRANSFORM: StudioTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AdminVTOCalibrationStudioProps {
  glbUrl: string;
  bridge: StudioBridge;
  /** 'manual' = non-zero bridge was set explicitly; 'auto' = zero / unset bridge. */
  bridgeSource: BridgeSource;
  transform: StudioTransform;
  /** True = auto-fit mode; false = legacy mode (exact original behaviour). */
  isOffsetMode: boolean;
  onChange: (next: StudioTransform) => void;
  onIsOffsetModeChange: (next: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminVTOCalibrationStudio({
  glbUrl,
  bridge,
  bridgeSource,
  transform,
  isOffsetMode,
  onChange,
  onIsOffsetModeChange,
}: AdminVTOCalibrationStudioProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [detectorState, setDetectorState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detectorError, setDetectorError] = useState<string | null>(null);
  const [showHeadOcclusion, setShowHeadOcclusion] = useState(false);
  const [debugOccluderMesh, setDebugOccluderMesh] = useState(false);
  const [modelMeasurement, setModelMeasurement] = useState<ModelMeasurement | null>(null);

  const latestDetectionRef = useRef<FaceDetectionResult | null>(null);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof initFaceLandmarker>> | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const {
    stream,
    isStreaming,
    isLoading: cameraLoading,
    error: cameraError,
    attachVideo,
  } = useCameraController({ autoStart: true, idealWidth: 1280, idealHeight: 720 });

  const cameraState = cameraLoading
    ? 'starting…'
    : cameraError
    ? 'error'
    : isStreaming
    ? 'live'
    : 'starting…';

  const handleVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      attachVideo(el);
      if (el && stream) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.play().catch(() => {});
      }
    },
    [attachVideo, stream],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      if (video.srcObject !== stream) video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  // ── MediaPipe Detector ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lm = await initFaceLandmarker();
        if (cancelled) { lm.close?.(); return; }
        landmarkerRef.current = lm;
        setDetectorState('ready');
      } catch (err) {
        if (!cancelled) {
          setDetectorState('error');
          setDetectorError(err instanceof Error ? err.message : 'MediaPipe init failed');
        }
      }
    })();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, []);

  // ── Detection Loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isStreaming || detectorState !== 'ready') return;
    const video = videoRef.current;
    if (!video) return;

    runningRef.current = true;
    const loop = () => {
      if (!runningRef.current) return;
      if (
        !video.paused &&
        !video.ended &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        landmarkerRef.current
      ) {
        try {
          const nowMs = performance.now();
          const raw = landmarkerRef.current.detectForVideo(video, nowMs);
          if (raw) {
            latestDetectionRef.current = processFaceLandmarks(
              raw, video.videoWidth, video.videoHeight, nowMs,
            );
          }
        } catch { /* resilient */ }
      }
      if (runningRef.current) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      runningRef.current = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [isStreaming, detectorState]);

  // ── Derived state ─────────────────────────────────────────────────────────────
  const t = transform || DEFAULT_TRANSFORM;
  const setVec = (g: 'position' | 'rotation', a: 'x' | 'y' | 'z', v: number) =>
    onChange({ ...t, [g]: { ...t[g], [a]: v } });

  const displayError = detectorError ?? (cameraError?.message ?? null);

  const handleResetAutoFit = () => onChange(DEFAULT_TRANSFORM);

  const handleToggleOffsetMode = () => {
    if (isOffsetMode) {
      // Switching TO legacy — warn the user (no visual modal needed; console + state)
      onIsOffsetModeChange(false);
    } else {
      onIsOffsetModeChange(true);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden flex flex-col lg:flex-row">
      {/* ── Left: Video + AR overlay ── */}
      <div className="w-full lg:w-auto lg:flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-neutral-800">
        <div className="relative" style={{ height: '380px' }}>
          {/* Camera feed */}
          <video
            ref={handleVideoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              background: '#000',
            }}
          />

          {/* 3D AR overlay — fills same box */}
          {glbUrl && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <AdminVTORenderer
                glbUrl={glbUrl}
                bridge={bridge}
                bridgeSource={bridgeSource}
                isOffsetMode={isOffsetMode}
                transform={t}
                detectionRef={latestDetectionRef}
                showHeadOcclusion={showHeadOcclusion}
                debugOccluderMesh={debugOccluderMesh}
                onModelMeasured={setModelMeasurement}
              />
            </div>
          )}

          {/* Status pills */}
          <div className="absolute left-3 top-3 flex gap-2 text-[10px] font-bold uppercase z-20 pointer-events-none">
            <span className="rounded-full border border-neutral-700 bg-black/70 px-2 py-1 text-white">
              Camera: {cameraState}
            </span>
            <span className="rounded-full border border-neutral-700 bg-black/70 px-2 py-1 text-white">
              Face: {detectorState}
            </span>
            <span className={`rounded-full border px-2 py-1 ${
              isOffsetMode
                ? 'border-emerald-700 bg-emerald-950/70 text-emerald-300'
                : 'border-neutral-700 bg-black/70 text-neutral-400'
            }`}>
              {isOffsetMode ? 'Auto-Fit' : 'Legacy'}
            </span>
          </div>

          {/* Error banner */}
          {displayError && (
            <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-red-900 bg-red-950/80 p-2 text-xs text-red-200 z-20">
              {displayError}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Config panel ── */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-neutral-900/60 p-5 space-y-5 overflow-y-auto">

        {/* Mode toggle */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase text-neutral-500 font-semibold tracking-widest">Mode</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleOffsetMode}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                isOffsetMode
                  ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                  : 'border-neutral-700 bg-neutral-950 text-neutral-400'
              }`}
            >
              {isOffsetMode ? '✓ Auto-Fit ON' : 'Auto-Fit OFF (Legacy)'}
            </button>
            {isOffsetMode && (
              <button
                onClick={handleResetAutoFit}
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs font-bold text-neutral-300 hover:border-white hover:text-white transition-colors"
                title="Reset all offsets to zero (pure auto-fit)"
              >
                Reset
              </button>
            )}
          </div>
          {isOffsetMode && (
            <p className="text-[10px] text-neutral-500">
              Glasses are auto-sized to your face. Adjust offsets below for fine-tuning.
            </p>
          )}
          {!isOffsetMode && (
            <p className="text-[10px] text-amber-500/80">
              ⚠ Legacy mode — values are applied directly (no auto-fit).
            </p>
          )}
        </div>

        {/* Manual Transform header */}
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          {isOffsetMode ? 'Offset Adjustments' : 'Manual Transform'}
        </h3>

        {/* Position */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase text-neutral-500 font-semibold">Position</p>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={`p-${axis}`} className="flex items-center gap-3">
              <span className="w-4 text-[10px] uppercase text-neutral-500 font-bold">{axis}</span>
              <input
                type="number"
                step="0.01"
                value={t.position[axis]}
                onChange={(e) => setVec('position', axis, Number(e.target.value))}
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white"
              />
            </div>
          ))}
        </div>

        {/* Rotation */}
        <div className="space-y-2 pt-3 border-t border-neutral-800">
          <p className="text-[10px] uppercase text-neutral-500 font-semibold">Rotation °</p>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={`r-${axis}`} className="flex items-center gap-3">
              <span className="w-4 text-[10px] uppercase text-neutral-500 font-bold">{axis}</span>
              <input
                type="number"
                step="0.5"
                value={t.rotation[axis]}
                onChange={(e) => setVec('rotation', axis, Number(e.target.value))}
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white"
              />
            </div>
          ))}
        </div>

        {/* Scale */}
        <div className="space-y-2 pt-3 border-t border-neutral-800">
          <p className="text-[10px] uppercase text-neutral-500 font-semibold">
            {isOffsetMode ? 'Scale Adjust' : 'Scale'}
          </p>
          {isOffsetMode && (
            <p className="text-[10px] text-neutral-500">1.0 = auto-fit · &gt;1 = larger · &lt;1 = smaller</p>
          )}
          <input
            type="number"
            min="0.0001"
            step="0.01"
            value={t.scale}
            onChange={(e) => onChange({ ...t, scale: Number(e.target.value) })}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white"
          />
        </div>

        {/* Occluder controls */}
        <div className="space-y-2 pt-3 border-t border-neutral-800">
          <p className="text-[10px] uppercase text-neutral-500 font-semibold">Head Occlusion</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showHeadOcclusion}
              onChange={(e) => setShowHeadOcclusion(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-neutral-300">Enable (temples hidden behind face)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={debugOccluderMesh}
              onChange={(e) => setDebugOccluderMesh(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-neutral-400">Debug: show occluder mesh</span>
          </label>
        </div>

        {/* Model info (auto-fit mode only) */}
        {isOffsetMode && modelMeasurement && (
          <div className="pt-3 border-t border-neutral-800 space-y-1">
            <p className="text-[10px] uppercase text-neutral-500 font-semibold">Model bbox</p>
            <p className="text-[10px] font-mono text-neutral-400">
              W {modelMeasurement.nativeWidth.toFixed(3)} ·{' '}
              H {modelMeasurement.nativeHeight.toFixed(3)} ·{' '}
              D {modelMeasurement.nativeDepth.toFixed(3)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
