// src/lib/supabase/service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, ProductVariant } from '../commerce/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uijncyzhguftcdonkcdg.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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

export function mapProductToRow(product: Product): any {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    collection: product.collection,
    category: product.category,
    description: product.description,
    features: product.features,
    face_shape: product.faceShape,
    default_price: product.defaultPrice,
    default_original_price: product.defaultOriginalPrice,
    default_material: product.defaultMaterial,
    default_weight: product.defaultWeight,
    frame_width_mm: product.defaultSpecifications.frameWidthMm,
    lens_width_mm: product.defaultSpecifications.lensWidthMm,
    bridge_width_mm: product.defaultSpecifications.bridgeWidthMm,
    temple_length_mm: product.defaultSpecifications.templeLengthMm,
    frame_size: product.defaultSpecifications.frameSize,
    prescription_required: product.prescriptionRequired,
    try_on_available: product.tryOnAvailable,
    hide_when_out_of_stock: product.hideWhenOutOfStock ?? true,
    status: product.status,
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

export function mapVariantToRow(variant: ProductVariant): any {
  return {
    id: variant.id,
    product_id: variant.productId,
    slug: variant.slug,
    name: variant.name,
    sku: variant.sku,
    color_name: variant.colorName,
    color_hex: variant.colorHex,
    price_override: variant.priceOverride,
    original_price_override: variant.originalPriceOverride,
    material_override: variant.materialOverride,
    weight_override: variant.weightOverride,
    specifications_override: variant.specificationsOverride,
    description_override: variant.descriptionOverride,
    glb_path: variant.glbPath,
    in_stock: variant.inStock,
    stock_level: variant.stockLevel,
    units_in_stock: variant.unitsInStock,
    hide_when_out_of_stock: variant.hideWhenOutOfStock,
    sort_order: variant.sortOrder,
    status: variant.status,
    updated_at: new Date().toISOString(),
  };
}
