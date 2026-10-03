// src/lib/supabase/service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, ProductVariant } from '../commerce/types';
import { resolveSupabaseKey } from './resolve-key';

/**
 * Step 2.3: resolve the client through resolveSupabaseKey, which never degrades
 * to the anon key in production. If the service-role key is missing in
 * production we fail closed (no client => routes return 500) instead of quietly
 * running the admin API with downgraded privileges.
 */
function createSupabaseServiceClient(): SupabaseClient | null {
  try {
    const { url, key } = resolveSupabaseKey();
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err) {
    console.error('[FATAL] Supabase client misconfigured:', (err as Error).message);
    return null;
  }
}

export const supabase: SupabaseClient | null = createSupabaseServiceClient();

function finitePositiveOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function optionalFrameSize(row: any): string | undefined {
  if (typeof row.frame_size === 'string' && row.frame_size.trim()) return row.frame_size;
  const lens = finitePositiveOrNull(row.lens_width_mm);
  const bridge = finitePositiveOrNull(row.bridge_width_mm);
  const temple = finitePositiveOrNull(row.temple_length_mm);
  return lens !== null && bridge !== null && temple !== null ? `${lens}□${bridge}-${temple}` : undefined;
}

export function mapRowToProduct(row: any): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    collection: row.collection || 'sightly',
    category: row.category || 'unisex',
    description: row.description || '',
    features: Array.isArray(row.features) ? row.features : [],
    faceShape: Array.isArray(row.face_shape) ? row.face_shape : [],
    defaultPrice: Number(row.default_price) || 35000,
    defaultOriginalPrice: row.default_original_price ? Number(row.default_original_price) : undefined,
    defaultMaterial: row.default_material || 'Acetate',
    defaultWeight: row.default_weight || '22g',
    defaultSpecifications: {
      frameWidthMm: finitePositiveOrNull(row.frame_width_mm),
      lensWidthMm: finitePositiveOrNull(row.lens_width_mm),
      bridgeWidthMm: finitePositiveOrNull(row.bridge_width_mm),
      templeLengthMm: finitePositiveOrNull(row.temple_length_mm),
      frameSize: optionalFrameSize(row),
    } as Product['defaultSpecifications'],
    prescriptionRequired: row.prescription_required ?? true,
    tryOnAvailable: row.try_on_available ?? false,
    hideWhenOutOfStock: row.hide_when_out_of_stock ?? true,
    status: row.status || 'ACTIVE',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapProductToRow(product: Partial<Product>): any {
  const specs = product.defaultSpecifications;
  return {
    id: product.id || `prod-${Date.now()}`,
    slug: product.slug || `frame-${Date.now()}`,
    name: product.name || 'Unnamed Frame',
    collection: product.collection || 'sightly',
    category: product.category || 'unisex',
    description: product.description || '',
    features: Array.isArray(product.features) ? product.features : [],
    face_shape: Array.isArray(product.faceShape) ? product.faceShape : ['round', 'oval'],
    default_price: Number(product.defaultPrice) || 35000,
    default_original_price: product.defaultOriginalPrice ? Number(product.defaultOriginalPrice) : null,
    default_material: product.defaultMaterial || 'Acetate',
    default_weight: product.defaultWeight || '22g',
    frame_width_mm: finitePositiveOrNull(specs?.frameWidthMm),
    lens_width_mm: finitePositiveOrNull(specs?.lensWidthMm),
    bridge_width_mm: finitePositiveOrNull(specs?.bridgeWidthMm),
    temple_length_mm: finitePositiveOrNull(specs?.templeLengthMm),
    frame_size: specs?.frameSize || null,
    prescription_required: product.prescriptionRequired ?? true,
    try_on_available: product.tryOnAvailable ?? false,
    status: product.status || 'ACTIVE',
    updated_at: new Date().toISOString(),
  };
}

export function mapRowToVariant(row: any): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    slug: row.slug,
    name: row.name,
    sku: row.sku,
    colorName: row.color_name,
    colorHex: row.color_hex,
    priceOverride: row.price_override ? Number(row.price_override) : undefined,
    originalPriceOverride: row.original_price_override ? Number(row.original_price_override) : undefined,
    materialOverride: row.material_override || undefined,
    weightOverride: row.weight_override || undefined,
    specificationsOverride: row.specifications_override || undefined,
    descriptionOverride: row.description_override || undefined,
    glbPath: row.glb_path || undefined,
    vtoAssetId: row.vto_asset_id || undefined,
    vtoCalibrationId: row.vto_calibration_id || undefined,
    inStock: row.in_stock ?? true,
    stockLevel: row.stock_level || 'high',
    unitsInStock: row.units_in_stock ?? 10,
    hideWhenOutOfStock: row.hide_when_out_of_stock ?? false,
    sortOrder: row.sort_order ?? 0,
    status: row.status || 'ACTIVE',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapVariantToRow(variant: Partial<ProductVariant>): any {
  return {
    id: variant.id || `var-${Date.now()}`,
    product_id: variant.productId,
    slug: variant.slug || 'standard',
    name: variant.name || 'Standard Variant',
    sku: variant.sku || `SKU-${Date.now().toString().slice(-4)}`,
    color_name: variant.colorName || 'Standard',
    color_hex: variant.colorHex || '#000000',
    price_override: variant.priceOverride ? Number(variant.priceOverride) : null,
    original_price_override: variant.originalPriceOverride ? Number(variant.originalPriceOverride) : null,
    material_override: variant.materialOverride || null,
    weight_override: variant.weightOverride || null,
    specifications_override: variant.specificationsOverride || null,
    description_override: variant.descriptionOverride || null,
    glb_path: variant.glbPath || null,
    vto_asset_id: variant.vtoAssetId || null,
    vto_calibration_id: variant.vtoCalibrationId || null,
    in_stock: variant.inStock ?? true,
    stock_level: variant.stockLevel || 'high',
    units_in_stock: Number(variant.unitsInStock) ?? 20,
    hide_when_out_of_stock: variant.hideWhenOutOfStock ?? false,
    sort_order: Number(variant.sortOrder) || 0,
    status: variant.status || 'ACTIVE',
    updated_at: new Date().toISOString(),
  };
}
