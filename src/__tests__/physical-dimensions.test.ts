import { describe, expect, it } from 'vitest';
import { parsePositiveMillimeters, requirePhysicalDimensions } from '@/lib/vto/physical-dimensions';

describe('physical dimensions', () => {
  it('rejects missing measurements instead of inventing defaults', () => {
    expect(() => parsePositiveMillimeters(undefined, 'Frame width')).toThrow('Frame width must be a positive number');
    expect(() => parsePositiveMillimeters('', 'Lens width')).toThrow('Lens width must be a positive number');
    expect(() => requirePhysicalDimensions({ frameWidthMm: 140, lensWidthMm: 52, bridgeWidthMm: 18 })).toThrow('Complete physical eyewear dimensions are required');
  });

  it('accepts complete measured dimensions', () => {
    expect(requirePhysicalDimensions({ frameWidthMm: 140, lensWidthMm: 52, bridgeWidthMm: 18, templeLengthMm: 140 })).toMatchObject({
      frameWidthMm: 140,
      lensWidthMm: 52,
      bridgeWidthMm: 18,
      templeLengthMm: 140,
      frameSize: '52□18-140',
    });
  });
});
