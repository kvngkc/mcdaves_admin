// src/lib/vto/parametric-eyewear-builder.ts
/**
 * Parametric 3D Eyewear Generation Engine for Virtual Try-On.
 * Converts 2D optical specifications & styles into high-precision,
 * bilaterally symmetrical, real-world millimeter-calibrated 3D GLB models.
 * 
 * Features:
 * - 100% mathematical symmetry across the central nose bridge axis (0, 0, 0).
 * - Separate transparent optical glass lenses with real refractive/specular properties.
 * - Ergonomic face-wrap curvature (4-6 degree facial arch radius).
 * - Smooth acetate chamfers and calibrated 2.5cm temple hinge stubs.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three-stdlib';
import { optimizeGlbBuffer, OptimizationResult } from './glb-optimizer';

export type EyewearStyle = 'round' | 'cat-eye' | 'aviator' | 'rectangle' | 'square' | 'browline';

export interface ParametricEyewearOptions {
  style?: EyewearStyle;
  colorHex?: string;
  materialType?: 'acetate' | 'metal' | 'tortoise';
  frameWidthMm?: number;  // Total width (e.g. 140mm)
  lensWidthMm?: number;   // Single lens width (e.g. 52mm)
  lensHeightMm?: number;  // Single lens height (e.g. 42mm)
  bridgeWidthMm?: number; // Bridge width (e.g. 18mm)
  rimThicknessMm?: number;// Thickness of the frame rim (e.g. 3.2mm)
  faceWrapRadiusMm?: number; // Facial curvature radius (e.g. 140mm)
}

/**
 * Creates a 2D profile curve for a single lens rim based on the requested style.
 */
function createRimPath(
  style: EyewearStyle,
  width: number,
  height: number,
  isOuter: boolean,
  offset: number,
): THREE.Shape {
  const w = (width / 2) + (isOuter ? offset : 0);
  const h = (height / 2) + (isOuter ? offset : 0);
  const shape = new THREE.Shape();

  switch (style) {
    case 'cat-eye': {
      // Swept upward outer cat-eye corners
      const cornerLift = isOuter ? offset * 1.5 : 0;
      shape.moveTo(-w * 0.8, -h * 0.6);
      shape.bezierCurveTo(-w * 1.0, -h * 0.2, -w * 1.0, h * 0.4, -w * 0.7, h * 0.8);
      shape.bezierCurveTo(-w * 0.2, h * 1.0, w * 0.5, h * 0.9, w * 1.1 + cornerLift, h * 1.1 + cornerLift);
      shape.bezierCurveTo(w * 1.0, h * 0.3, w * 0.9, -h * 0.3, w * 0.6, -h * 0.7);
      shape.bezierCurveTo(w * 0.2, -h * 1.0, -w * 0.4, -h * 0.9, -w * 0.8, -h * 0.6);
      break;
    }

    case 'round': {
      // Classic round/circular frame
      const r = Math.min(w, h);
      shape.absellipse(0, 0, r, r * 0.95, 0, Math.PI * 2, false, 0);
      break;
    }

    case 'aviator': {
      // Teardrop aviator curve
      shape.moveTo(-w * 0.7, h * 0.7);
      shape.bezierCurveTo(-w * 0.1, h * 0.8, w * 0.6, h * 0.8, w * 0.9, h * 0.6);
      shape.bezierCurveTo(w * 1.05, h * 0.2, w * 0.9, -h * 0.6, w * 0.5, -h * 1.0);
      shape.bezierCurveTo(0, -h * 1.1, -w * 0.6, -h * 0.9, -w * 0.8, -h * 0.4);
      shape.bezierCurveTo(-w * 0.95, 0, -w * 0.95, h * 0.4, -w * 0.7, h * 0.7);
      break;
    }

    case 'square':
    case 'rectangle': {
      // Rounded rectangular shape
      const radius = 3.0;
      const x = -w;
      const y = -h;
      const fullW = w * 2;
      const fullH = h * 2;
      shape.moveTo(x + radius, y);
      shape.lineTo(x + fullW - radius, y);
      shape.quadraticCurveTo(x + fullW, y, x + fullW, y + radius);
      shape.lineTo(x + fullW, y + fullH - radius);
      shape.quadraticCurveTo(x + fullW, y + fullH, x + fullW - radius, y + fullH);
      shape.lineTo(x + radius, y + fullH);
      shape.quadraticCurveTo(x, y + fullH, x, y + fullH - radius);
      shape.lineTo(x, y + radius);
      shape.quadraticCurveTo(x, y, x + radius, y);
      break;
    }

    default: {
      // Universal soft oval
      shape.absellipse(0, 0, w, h, 0, Math.PI * 2, false, 0);
      break;
    }
  }

  return shape;
}

/**
 * Applies face-wrap cylindrical arch to vertices so the frame wraps the face naturally.
 */
function applyFaceWrapCurvature(geometry: THREE.BufferGeometry, radiusMm: number): void {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Spherical/cylindrical arch: delta Z = -(x^2) / (2 * R)
    const deltaZ = -(x * x) / (2 * radiusMm);
    pos.setZ(i, z + deltaZ);
  }
  geometry.computeVertexNormals();
}

/**
 * Generates a complete 3D Eyewear Model as a Three.js Group.
 */
export function buildParametricEyewear(options: ParametricEyewearOptions = {}): THREE.Group {
  const style = options.style || 'round';
  const colorHex = options.colorHex || '#2A1B14';
  const frameWidth = options.frameWidthMm || 140;
  const lensWidth = options.lensWidthMm || 50;
  const lensHeight = options.lensHeightMm || 40;
  const bridgeWidth = options.bridgeWidthMm || 18;
  const rimThickness = options.rimThicknessMm || 3.2;
  const wrapRadius = options.faceWrapRadiusMm || 145;

  const rootGroup = new THREE.Group();
  rootGroup.name = 'ParametricGlassesModel';

  // Centering: Half bridge + half lens width is the center of each lens
  const lensCenterOffset = (bridgeWidth / 2) + (lensWidth / 2);

  // ─── MATERIALS ─────────────────────────────────────────────────────────────
  
  // 1. Acetate / Metal Frame Material
  const frameColor = new THREE.Color(colorHex);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.25,
    metalness: options.materialType === 'metal' ? 0.85 : 0.1,
    envMapIntensity: 1.2,
  });

  // 2. Optical Glass Lens Material (Crystal Transparent with Specular Reflections)
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f0f6ff'),
    transparent: true,
    opacity: 0.3,
    roughness: 0.05,
    metalness: 0.05,
    transmission: 0.92,
    ior: 1.52, // Standard CR-39 optical plastic / glass index of refraction
    reflectivity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // ─── 1. FRONT RIMS (LEFT & RIGHT) ──────────────────────────────────────────
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 3.2,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.4,
    bevelOffset: 0,
    bevelSegments: 3,
  };

  // Right Rim Shape with Hole (Viewer's Left, Model's Right: +X)
  const rightOuter = createRimPath(style, lensWidth, lensHeight, true, rimThickness);
  const rightInner = createRimPath(style, lensWidth, lensHeight, false, 0);
  rightOuter.holes.push(rightInner);

  const rightRimGeom = new THREE.ExtrudeGeometry(rightOuter, extrudeSettings);
  rightRimGeom.center();
  applyFaceWrapCurvature(rightRimGeom, wrapRadius);
  const rightRimMesh = new THREE.Mesh(rightRimGeom, frameMaterial);
  rightRimMesh.position.set(lensCenterOffset, 0, 0);
  rootGroup.add(rightRimMesh);

  // Left Rim Shape with Hole (Viewer's Right, Model's Left: -X)
  // Perfectly mirrored across the Y-axis for 100% mathematical symmetry
  const leftOuter = createRimPath(style, lensWidth, lensHeight, true, rimThickness);
  const leftInner = createRimPath(style, lensWidth, lensHeight, false, 0);
  leftOuter.holes.push(leftInner);

  const leftRimGeom = new THREE.ExtrudeGeometry(leftOuter, extrudeSettings);
  leftRimGeom.center();
  leftRimGeom.scale(-1, 1, 1); // Exact horizontal symmetry
  applyFaceWrapCurvature(leftRimGeom, wrapRadius);
  const leftRimMesh = new THREE.Mesh(leftRimGeom, frameMaterial);
  leftRimMesh.position.set(-lensCenterOffset, 0, 0);
  rootGroup.add(leftRimMesh);

  // ─── 2. TRANSPARENT OPTICAL LENSES ─────────────────────────────────────────
  const lensGeomRight = new THREE.ShapeGeometry(rightInner);
  lensGeomRight.center();
  applyFaceWrapCurvature(lensGeomRight, wrapRadius);
  const rightLensMesh = new THREE.Mesh(lensGeomRight, lensMaterial);
  rightLensMesh.position.set(lensCenterOffset, 0, 0.5);
  rootGroup.add(rightLensMesh);

  const lensGeomLeft = new THREE.ShapeGeometry(leftInner);
  lensGeomLeft.center();
  lensGeomLeft.scale(-1, 1, 1);
  applyFaceWrapCurvature(lensGeomLeft, wrapRadius);
  const leftLensMesh = new THREE.Mesh(lensGeomLeft, lensMaterial);
  leftLensMesh.position.set(-lensCenterOffset, 0, 0.5);
  rootGroup.add(leftLensMesh);

  // ─── 3. NOSE BRIDGE ARCH (Centered at (0, 0, 0)) ──────────────────────────
  const bridgeCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-bridgeWidth * 0.6, lensHeight * 0.2, 0),
    new THREE.Vector3(-bridgeWidth * 0.2, lensHeight * 0.35, 1.0),
    new THREE.Vector3(bridgeWidth * 0.2, lensHeight * 0.35, 1.0),
    new THREE.Vector3(bridgeWidth * 0.6, lensHeight * 0.2, 0),
  );
  const bridgeGeom = new THREE.TubeGeometry(bridgeCurve, 12, 1.4, 8, false);
  const bridgeMesh = new THREE.Mesh(bridgeGeom, frameMaterial);
  rootGroup.add(bridgeMesh);

  // ─── 4. NOSE PADS ─────────────────────────────────────────────────────────
  const padMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f5f5f5'),
    roughness: 0.4,
    transparent: true,
    opacity: 0.85,
  });

  const padGeom = new THREE.CapsuleGeometry(1.2, 3.5, 6, 8);
  const rightPad = new THREE.Mesh(padGeom, padMaterial);
  rightPad.position.set(bridgeWidth * 0.5, -lensHeight * 0.15, -2.5);
  rightPad.rotation.set(0.2, 0, -0.4);
  rootGroup.add(rightPad);

  const leftPad = new THREE.Mesh(padGeom, padMaterial);
  leftPad.position.set(-bridgeWidth * 0.5, -lensHeight * 0.15, -2.5);
  leftPad.rotation.set(0.2, 0, 0.4);
  rootGroup.add(leftPad);

  // ─── 5. TEMPLE HINGE STUBS (Calibrated 2.5cm) ──────────────────────────────
  const stubLength = 25.0; // 25mm = 2.5cm (clipped temple handles)
  const stubGeom = new THREE.BoxGeometry(2.0, 3.0, stubLength);
  stubGeom.translate(0, 0, -stubLength / 2);

  const rightStub = new THREE.Mesh(stubGeom, frameMaterial);
  const hingeX = (frameWidth / 2) - 2;
  const hingeZ = -(hingeX * hingeX) / (2 * wrapRadius);
  rightStub.position.set(hingeX, lensHeight * 0.25, hingeZ);
  rightStub.rotation.y = -0.08;
  rootGroup.add(rightStub);

  const leftStub = new THREE.Mesh(stubGeom, frameMaterial);
  leftStub.position.set(-hingeX, lensHeight * 0.25, hingeZ);
  leftStub.rotation.y = 0.08;
  rootGroup.add(leftStub);

  return rootGroup;
}

/**
 * Converts a Three.js scene/group into an optimized binary GLB buffer.
 */
export async function exportGroupToOptimizedGlb(
  group: THREE.Group,
): Promise<OptimizationResult> {
  const exporter = new GLTFExporter();

  const glbArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          // If JSON text output, convert
          const str = JSON.stringify(result);
          const buf = new TextEncoder().encode(str).buffer;
          resolve(buf);
        }
      },
      (error) => reject(error),
      { binary: true },
    );
  });

  const rawBuffer = Buffer.from(glbArrayBuffer);

  // Run through our automated compression pipeline
  return optimizeGlbBuffer(rawBuffer, { maxTextureDimension: 1024, textureQuality: 85 });
}
