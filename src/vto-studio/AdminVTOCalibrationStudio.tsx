'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useCameraController } from './camera/CameraController';
import { initFaceLandmarker, processFaceLandmarks } from './tracking/FaceLandmarker';
import { FaceDetectionResult, LetterboxViewport } from './tracking/FaceTrackingTypes';
import VTOVideo, { computeLetterboxViewport } from './components/VTOVideo';

const AdminVTORenderer = dynamic(() => import('./components/AdminVTORenderer'), {
  ssr: false,
});

export type StudioTransform = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
};

export type StudioBridge = { x: number; y: number; z: number };

const DEFAULT_TRANSFORM: StudioTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};

export interface AdminVTOCalibrationStudioProps {
  glbUrl: string;
  bridge: StudioBridge;
  transform: StudioTransform;
  onChange: (next: StudioTransform) => void;
}

export default function AdminVTOCalibrationStudio({
  glbUrl,
  bridge,
  transform,
  onChange,
}: AdminVTOCalibrationStudioProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 640, height: 480 });
  const [viewport, setViewport] = useState<LetterboxViewport>({
    left: 0,
    top: 0,
    width: 640,
    height: 480,
    videoWidth: 640,
    videoHeight: 480,
    containerWidth: 640,
    containerHeight: 480,
  });

  const [detectorState, setDetectorState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  // mutable tracking ref for zero-latency sync with the Canvas
  const latestDetectionRef = useRef<FaceDetectionResult | null>(null);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof initFaceLandmarker>> | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  // 1. Camera Lifecycle
  const {
    stream,
    videoWidth,
    videoHeight,
    isStreaming,
    isLoading: cameraLoading,
    error: cameraError,
    attachVideo,
  } = useCameraController({ autoStart: true, idealWidth: 1280, idealHeight: 720 });

  const cameraState = cameraLoading ? 'starting' : cameraError ? 'error' : isStreaming ? 'live' : 'starting';

  // 2. Container Resize Observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 3. Compute Viewport
  useEffect(() => {
    const vp = computeLetterboxViewport(
      containerSize.width,
      containerSize.height,
      videoWidth || 640,
      videoHeight || 480
    );
    setViewport(vp);
  }, [containerSize, videoWidth, videoHeight]);

  // 4. Initialize MediaPipe Detector
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const landmarker = await initFaceLandmarker();
        if (cancelled) {
          landmarker.close?.();
          return;
        }
        landmarkerRef.current = landmarker;
        setDetectorState('ready');
      } catch (err) {
        if (!cancelled) {
          setDetectorState('error');
          setError(err instanceof Error ? err.message : 'MediaPipe failed to initialize');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close?.();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // 5. Detection Loop
  useEffect(() => {
    if (!isStreaming || detectorState !== 'ready' || !landmarkerRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    runningRef.current = true;
    const detectLoop = () => {
      if (!runningRef.current) return;
      if (
        video &&
        !video.paused &&
        !video.ended &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        landmarkerRef.current
      ) {
        try {
          const nowMs = performance.now();
          const raw = landmarkerRef.current.detectForVideo(video, nowMs);
          if (raw) {
            const processed = processFaceLandmarks(raw, video.videoWidth, video.videoHeight, nowMs);
            latestDetectionRef.current = processed;
          }
        } catch {
          // Keep loop resilient
        }
      }
      if (runningRef.current) {
        rafRef.current = requestAnimationFrame(detectLoop);
      }
    };
    rafRef.current = requestAnimationFrame(detectLoop);
    return () => {
      runningRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isStreaming, detectorState]);

  const handleVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      attachVideo(el);
    },
    [attachVideo]
  );

  const t = transform || DEFAULT_TRANSFORM;
  const setVector = (group: 'position' | 'rotation', axis: 'x' | 'y' | 'z', value: number) =>
    onChange({ ...transform, [group]: { ...transform[group], [axis]: value } });

  const displayError = error || (cameraError ? cameraError.message : null);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden flex flex-col lg:flex-row">
      {/* 4:3 Fitting Area (Flexible Viewport) - Left Side */}
      <div className="flex-1 border-b lg:border-b-0 lg:border-r border-neutral-800">
        <div ref={containerRef} className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center w-full h-full">
          {/* Camera Feed */}
          <VTOVideo
            ref={handleVideoRef}
            stream={stream}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            videoWidth={videoWidth}
            videoHeight={videoHeight}
            mirrored={true}
          />

          {/* 3D AR Overlay */}
          {glbUrl && (
            <AdminVTORenderer
              viewport={viewport}
              glbUrl={glbUrl}
              bridge={bridge}
              transform={t}
              detectionRef={latestDetectionRef}
            />
          )}

          {/* UI Overlays */}
          <div className="absolute left-3 top-3 flex gap-2 text-[10px] font-bold uppercase z-20">
            <span className="rounded-full border border-neutral-700 bg-black/70 px-2 py-1">
              Camera: {cameraState}
            </span>
            <span className="rounded-full border border-neutral-700 bg-black/70 px-2 py-1">
              Face: {detectorState}
            </span>
          </div>

          {displayError && (
            <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-red-900 bg-red-950/80 p-2 text-xs text-red-200 z-20">
              {displayError}
            </div>
          )}
        </div>
      </div>

      {/* Manual Calibration Controls - Right Side */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-neutral-900/50 p-5 overflow-y-auto max-h-[600px] lg:max-h-none">
        <h3 className="text-sm font-bold text-white mb-4">Manual Transform</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <div key={`p-${axis}`} className="flex items-center justify-between gap-3">
                <label className="text-[10px] uppercase text-neutral-500 w-16">Pos {axis}</label>
                <input
                  type="number"
                  step="0.01"
                  value={t.position[axis]}
                  onChange={(e) => setVector('position', axis, Number(e.target.value))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white"
                />
              </div>
            ))}
          </div>
          
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <div key={`r-${axis}`} className="flex items-center justify-between gap-3">
                <label className="text-[10px] uppercase text-neutral-500 w-16">Rot {axis}°</label>
                <input
                  type="number"
                  step="0.1"
                  value={t.rotation[axis]}
                  onChange={(e) => setVector('rotation', axis, Number(e.target.value))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[10px] uppercase text-neutral-500 w-16">Scale</label>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={t.scale}
                onChange={(e) => onChange({ ...t, scale: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
