// src/lib/supabase/service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, ProductVariant } from '../commerce/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = (() => {
  if (!supabaseUrl) return null;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[FATAL] SUPABASE_SERVICE_ROLE_KEY is missing in production! Admin API will fail.');
      // We don't throw here to avoid crashing the build, but we will return null
      // so API routes can explicitly throw 500 when they try to use it.
    }
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return key ? createClient(supabaseUrl, key) : null;
})();

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
      frameWidthMm: Number(row.frame_width_mm) || 140,
      lensWidthMm: Number(row.lens_width_mm) || 52,
      bridgeWidthMm: Number(row.bridge_width_mm) || 18,
      templeLengthMm: Number(row.temple_length_mm) || 140,
      frameSize: row.frame_size || '52□18-140',
    },
    prescriptionRequired: row.prescription_required ?? true,
    tryOnAvailable: row.try_on_available ?? true,
    hideWhenOutOfStock: row.hide_when_out_of_stock ?? true,
    status: row.status || 'ACTIVE',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapProductToRow(product: Partial<Product>): any {
  const specs = product.defaultSpecifications || {
    frameWidthMm: 140,
    lensWidthMm: 52,
    bridgeWidthMm: 18,
    templeLengthMm: 140,
    frameSize: '52□18-140',
  };

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
    frame_width_mm: Number(specs.frameWidthMm) || 140,
    lens_width_mm: Number(specs.lensWidthMm) || 52,
    bridge_width_mm: Number(specs.bridgeWidthMm) || 18,
    temple_length_mm: Number(specs.templeLengthMm) || 140,
    frame_size: specs.frameSize || `${Number(specs.lensWidthMm) || 52}□${Number(specs.bridgeWidthMm) || 18}-${Number(specs.templeLengthMm) || 140}`,
    prescription_required: product.prescriptionRequired ?? true,
    try_on_available: product.tryOnAvailable ?? true,
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
    in_stock: variant.inStock ?? true,
    stock_level: variant.stockLevel || 'high',
    units_in_stock: Number(variant.unitsInStock) ?? 20,
    hide_when_out_of_stock: variant.hideWhenOutOfStock ?? false,
    sort_order: Number(variant.sortOrder) || 0,
    status: variant.status || 'ACTIVE',
    updated_at: new Date().toISOString(),
  };
}
