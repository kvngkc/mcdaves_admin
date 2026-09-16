export type Vec3 = { x: number; y: number; z: number };
export type ManualTransform = { position: Vec3; rotation: Vec3; scale: number };

export const DEFAULT_MANUAL_TRANSFORM: ManualTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};

export function isValidManualTransform(value: unknown): value is ManualTransform {
  if (!value || typeof value !== 'object') return false;
  const t = value as any;
  const validVec3 = (v: any) => v && ['x', 'y', 'z'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]));
  return validVec3(t.position) && validVec3(t.rotation) && typeof t.scale === 'number' && Number.isFinite(t.scale) && t.scale > 0;
}
