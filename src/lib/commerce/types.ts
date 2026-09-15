// src/lib/commerce/types.ts
export type ProductCategory = 'men' | 'women' | 'unisex' | 'sunglasses';
export type ProductCollection = 'sightly';
export type StockLevel = 'high' | 'low' | 'out';

export interface ProductMedia {
  id: string;
  variantId?: string;
  productId: string;
  type: 'front' | 'side' | 'lifestyle' | 'model' | 'detail';
  url: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface PhysicalSpecifications {
  frameWidthMm: number | null;
  lensWidthMm: number | null;
  bridgeWidthMm: number | null;
  templeLengthMm: number | null;
  frameSize?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  collection: ProductCollection;
  category: ProductCategory;
  description: string;
  features: string[];
  faceShape: ('round' | 'oval' | 'square' | 'heart' | 'diamond')[];
  defaultPrice: number;
  defaultOriginalPrice?: number;
  defaultMaterial: string;
  defaultWeight: string;
  defaultSpecifications: PhysicalSpecifications;
  prescriptionRequired: boolean;
  tryOnAvailable: boolean;
  hideWhenOutOfStock?: boolean;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  colorName: string;
  colorHex: string;
  priceOverride?: number;
  originalPriceOverride?: number;
  materialOverride?: string;
  weightOverride?: string;
  specificationsOverride?: Partial<PhysicalSpecifications>;
  descriptionOverride?: string;
  /** @deprecated Legacy storage URL. VTO identity is vtoAssetId. */
  glbPath?: string;
  /** Authoritative VTO asset identity, linked to vto_asset_calibrations. */
  vtoAssetId?: string;
  vtoCalibrationId?: string;
  inStock: boolean;
  stockLevel: StockLevel;
  unitsInStock?: number;
  hideWhenOutOfStock?: boolean;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedProductVariant extends ProductVariant {
  effectivePrice: number;
  effectiveOriginalPrice?: number;
  effectiveMaterial: string;
  effectiveWeight: string;
  effectiveSpecifications: PhysicalSpecifications;
  effectiveDescription: string;
  media: ProductMedia[];
  hasPriceOverride: boolean;
  hasSpecOverride: boolean;
}

export interface ResolvedProduct extends Product {
  variants: ResolvedProductVariant[];
  defaultVariant: ResolvedProductVariant;
  media: ProductMedia[];
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderIntentStatus = 'NEW' | 'WHATSAPP_OPENED' | 'IN_CONVERSATION' | 'CONSULTATION' | 'AWAITING_CUSTOMER' | 'PAYMENT_PENDING' | 'CONVERTED' | 'LOST' | 'CANCELLED';

export interface OrderIntent {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  variantSku: string;
  quantity: number;
  priceAtIntent: number;
  currency: string;
  lensRequestId?: string;
  vtoSessionRef?: string;
  status: OrderIntentStatus;
  source: string;
  notes?: string;
  paymentLinkUrl?: string;
  whatsappReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  lensRequestId?: string;
}

export interface Order {
  id: string;
  orderIntentId?: string;
  customerId: string;
  paymentId: string;
  paymentReference: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  status: 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  shippingAddress?: any;
  customerNotes?: string;
  prescriptionOption?: string;
  prescriptionFileUrl?: string;
  createdAt: string;
  updatedAt: string;
}
