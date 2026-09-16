// src/vto-lab/camera/CameraController.ts
/**
 * Standalone Camera Controller for VTO Lab.
 * Manages getUserMedia stream acquisition, track teardown, and lifecycle.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { CameraState } from '../tracking/FaceTrackingTypes';

export interface UseCameraControllerOptions {
  idealWidth?: number;
  idealHeight?: number;
  facingMode?: 'user' | 'environment';
  autoStart?: boolean;
}

export function useCameraController(options: UseCameraControllerOptions = {}) {
  const {
    idealWidth = 640,
    idealHeight = 480,
    facingMode = 'user',
    autoStart = false,
  } = options;

  const [state, setState] = useState<CameraState>({
    stream: null,
    videoElement: null,
    videoWidth: 0,
    videoHeight: 0,
    isStreaming: false,
    isLoading: false,
    error: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {
          // Ignore track stop errors during teardown
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // Ignore pause errors during teardown
      }
      videoRef.current.srcObject = null;
    }

    setState((prev) => ({
      ...prev,
      stream: null,
      isStreaming: false,
      isLoading: false,
      videoWidth: 0,
      videoHeight: 0,
    }));
  }, []);

  const startCamera = useCallback(async (): Promise<MediaStream> => {
    stopCamera();

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      const err = new Error(
        'WebRTC getUserMedia camera API is not supported in this browser.',
      );
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err,
      }));
      throw err;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode,
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
        },
      };

      const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              'Camera permission request timed out. Please allow camera permissions in browser settings.',
            ),
          );
        }, 15000);
      });

      const mediaStream = (await Promise.race([
        streamPromise,
        timeoutPromise,
      ])) as MediaStream;
      if (timeoutId) clearTimeout(timeoutId);

      streamRef.current = mediaStream;

      setState((prev) => ({
        ...prev,
        stream: mediaStream,
        isLoading: false,
        isStreaming: true,
        error: null,
      }));

      return mediaStream;
    } catch (err: unknown) {
      const normalized =
        err instanceof Error
          ? err
          : new Error(String(err) || 'Failed to acquire camera stream.');

      setState((prev) => ({
        ...prev,
        stream: null,
        isStreaming: false,
        isLoading: false,
        error: normalized,
      }));

      throw normalized;
    }
  }, [facingMode, idealHeight, idealWidth, stopCamera]);

  const attachVideo = useCallback((videoEl: HTMLVideoElement | null) => {
    videoRef.current = videoEl;
    if (!videoEl) return;

    if (streamRef.current && videoEl.srcObject !== streamRef.current) {
      videoEl.srcObject = streamRef.current;
      videoEl.play().catch(() => {});
    }
  }, []);

  // Sync stream to video element whenever stream state updates
  useEffect(() => {
    const video = videoRef.current;
    const stream = state.stream;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const updateDimensions = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setState((prev) => ({
          ...prev,
          videoElement: video,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        }));
      }
    };

    video.addEventListener('loadedmetadata', updateDimensions);
    video.addEventListener('resize', updateDimensions);

    video.play().catch((playErr) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[VTO-Lab] Video play blocked or interrupted:', playErr);
      }
    });

    updateDimensions();

    return () => {
      video.removeEventListener('loadedmetadata', updateDimensions);
      video.removeEventListener('resize', updateDimensions);
    };
  }, [state.stream]);

  useEffect(() => {
    if (autoStart) {
      startCamera().catch(() => {});
    }
    return () => {
      stopCamera();
    };
  }, [autoStart, startCamera, stopCamera]);

  return {
    stream: state.stream,
    videoElement: videoRef.current,
    videoWidth: state.videoWidth,
    videoHeight: state.videoHeight,
    isStreaming: state.isStreaming,
    isLoading: state.isLoading,
    error: state.error,
    startCamera,
    stopCamera,
    attachVideo,
  };
}
