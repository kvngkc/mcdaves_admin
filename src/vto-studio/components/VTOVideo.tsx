// src/vto-lab/components/VTOVideo.tsx
/**
 * Video Display Component with dynamic letterbox viewport calculation.
 * Ensures the underlying camera feed and 3D canvas share the exact same rendered bounding box.
 */

'use client';

import React, { forwardRef, useMemo, useEffect, useRef } from 'react';
import { LetterboxViewport } from '../tracking/FaceTrackingTypes';

export interface VTOVideoProps {
  stream?: MediaStream | null;
  containerWidth: number;
  containerHeight: number;
  videoWidth: number;
  videoHeight: number;
  mirrored?: boolean;
  onViewportChanged?: (viewport: LetterboxViewport) => void;
}

export function computeLetterboxViewport(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): LetterboxViewport {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    videoWidth <= 0 ||
    videoHeight <= 0
  ) {
    return {
      left: 0,
      top: 0,
      width: containerWidth || 640,
      height: containerHeight || 480,
      videoWidth,
      videoHeight,
      containerWidth,
      containerHeight,
    };
  }

  const containerAspect = containerWidth / containerHeight;
  const videoAspect = videoWidth / videoHeight;

  let width: number;
  let height: number;
  let left: number;
  let top: number;

  if (videoAspect > containerAspect) {
    // Letterbox on top/bottom
    width = containerWidth;
    height = width / videoAspect;
    left = 0;
    top = (containerHeight - height) / 2;
  } else {
    // Pillarbox on left/right
    height = containerHeight;
    width = height * videoAspect;
    left = (containerWidth - width) / 2;
    top = 0;
  }

  return {
    left,
    top,
    width,
    height,
    videoWidth,
    videoHeight,
    containerWidth,
    containerHeight,
  };
}

export const VTOVideo = forwardRef<HTMLVideoElement, VTOVideoProps>(
  function VTOVideo(
    {
      stream,
      containerWidth,
      containerHeight,
      videoWidth,
      videoHeight,
      mirrored = true,
      onViewportChanged,
    },
    forwardedRef,
  ) {
    const internalRef = useRef<HTMLVideoElement | null>(null);

    const setRefs = (el: HTMLVideoElement | null) => {
      internalRef.current = el;
      if (typeof forwardedRef === 'function') {
        forwardedRef(el);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
      }
    };

    // Ensure video.srcObject is immediately attached when stream changes
    useEffect(() => {
      const video = internalRef.current;
      if (!video) return;

      if (stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch((err) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[VTO-Lab] Video play failed:', err);
          }
        });
      } else if (!stream) {
        video.srcObject = null;
      }
    }, [stream]);

    const viewport = useMemo(() => {
      const vp = computeLetterboxViewport(
        containerWidth,
        containerHeight,
        videoWidth,
        videoHeight,
      );
      if (onViewportChanged) onViewportChanged(vp);
      return vp;
    }, [containerWidth, containerHeight, videoWidth, videoHeight, onViewportChanged]);

    return (
      <div
        className="absolute overflow-hidden"
        style={{
          left: viewport.left,
          top: viewport.top,
          width: viewport.width,
          height: viewport.height,
        }}
      >
        <video
          ref={setRefs}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-fill"
          style={{
            transform: mirrored ? 'scaleX(-1)' : 'none',
            transformOrigin: 'center',
          }}
          aria-label="VTO Camera Feed"
        />
      </div>
    );
  },
);

export default VTOVideo;
