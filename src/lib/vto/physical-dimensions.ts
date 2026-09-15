import { z } from 'zod';

export const PhysicalDimensionsSchema = z.object({
  frameWidthMm: z.number().finite().positive(),
  lensWidthMm: z.number().finite().positive(),
  bridgeWidthMm: z.number().finite().positive(),
  templeLengthMm: z.number().finite().positive(),
  frameSize: z.string().trim().min(1).optional(),
});

export type PhysicalDimensions = z.infer<typeof PhysicalDimensionsSchema>;

export function requirePhysicalDimensions(value: unknown): PhysicalDimensions {
  const result = PhysicalDimensionsSchema.safeParse(value);
  if (!result.success) {
    throw new Error('Complete physical eyewear dimensions are required: frame width, lens width, bridge width, and temple length must all be positive numbers.');
  }
  return {
    ...result.data,
    frameSize:
      result.data.frameSize ||
      `${result.data.lensWidthMm}□${result.data.bridgeWidthMm}-${result.data.templeLengthMm}`,
  };
}

export function parsePositiveMillimeters(value: unknown, fieldName: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive number in millimeters.`);
  }
  return parsed;
}
