import { describe, expect, it } from 'vitest';
import { DEFAULT_MANUAL_TRANSFORM, isValidManualTransform } from '@/lib/vto/manual-calibration';

describe('manual VTO calibration contract', () => {
  it('accepts the canonical transform', () => expect(isValidManualTransform(DEFAULT_MANUAL_TRANSFORM)).toBe(true));
  it('rejects zero or negative scale', () => expect(isValidManualTransform({ ...DEFAULT_MANUAL_TRANSFORM, scale: 0 })).toBe(false));
  it('rejects incomplete vectors', () => expect(isValidManualTransform({ position:{x:0,y:0}, rotation:{x:0,y:0,z:0}, scale:1 })).toBe(false));
  it('rejects non-finite values', () => expect(isValidManualTransform({ position:{x:0,y:0,z:Infinity}, rotation:{x:0,y:0,z:0}, scale:1 })).toBe(false));
});
