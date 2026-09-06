'use client';
import { apiFetch } from '@/lib/api-client';

import React, { useState, useEffect } from 'react';
import { Package, X, Upload, AlertCircle } from 'lucide-react';
import { Product, ResolvedProduct, PhysicalSpecifications } from '@/lib/commerce/types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ResolvedProduct | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function ProductModal({ isOpen, onClose, product, onSuccess, onError }: ProductModalProps) {
  const [productFormData, setProductFormData] = useState<Partial<Product & { media?: any[] }>>({});
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState<string | null>(null);

  const isCreatingProduct = !product;

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setProductFormData({
          ...product,
          hideWhenOutOfStock: product.hideWhenOutOfStock ?? true,
          features: [...product.features],
          defaultSpecifications: { ...product.defaultSpecifications },
        });
      } else {
        setProductFormData({
          id: `prod-sightly-${Date.now().toString().slice(-4)}`,
          name: '',
          slug: '',
          collection: 'sightly',
          category: 'unisex',
          description: '',
          features: ['Prescription-ready frame', 'Ultra-lightweight comfort'],
          faceShape: ['round', 'oval'],
          defaultPrice: 35000,
          defaultOriginalPrice: 42000,
          defaultMaterial: 'Acetate',
          defaultWeight: '22g',
          defaultSpecifications: {
            frameWidthMm: 140,
            lensWidthMm: 52,
            bridgeWidthMm: 18,
            templeLengthMm: 140,
            frameSize: '52□18-140',
          },
          prescriptionRequired: true,
          tryOnAvailable: true,
          hideWhenOutOfStock: true,
          status: 'ACTIVE',
        });
      }
    }
  }, [isOpen, product]);

  const handleImageUpload = async (file: File, imageType: 'front' | 'side' | 'lifestyle') => {
    setIsUploadingImage(imageType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', imageType);

      const res = await apiFetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setProductFormData((prev: any) => {
          const currentMedia = Array.isArray(prev.media) ? [...prev.media] : [];
          const existingIdx = currentMedia.findIndex(
            (m: any) => m.mediaType === `image_${imageType}` || m.type === imageType,
          );
          const newMediaItem = {
            id: `med-${Date.now()}`,
            url: data.imageUrl,
            altText: `${prev.name || 'Product'} ${imageType}`,
            mediaType: `image_${imageType}`,
            isPrimary: imageType === 'front',
            sortOrder: imageType === 'front' ? 0 : imageType === 'side' ? 1 : 2,
          };
          if (existingIdx >= 0) {
            currentMedia[existingIdx] = newMediaItem;
          } else {
            currentMedia.push(newMediaItem);
          }
          return { ...prev, media: currentMedia };
        });
        onSuccess(`Uploaded ${imageType} view photo!`);
      } else {
        onError(data.error || 'Failed to upload photo');
      }
    } catch {
      onError('Network error uploading photo');
    } finally {
      setIsUploadingImage(null);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.name?.trim()) {
      onError('Product name is required');
      return;
    }

    const slug =
      productFormData.slug?.trim() ||
      productFormData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    const specs: PhysicalSpecifications = {
      frameWidthMm: Number(productFormData.defaultSpecifications?.frameWidthMm) || 140,
      lensWidthMm: Number(productFormData.defaultSpecifications?.lensWidthMm) || 52,
      bridgeWidthMm: Number(productFormData.defaultSpecifications?.bridgeWidthMm) || 18,
      templeLengthMm: Number(productFormData.defaultSpecifications?.templeLengthMm) || 140,
      frameSize: `${Number(productFormData.defaultSpecifications?.lensWidthMm) || 52}□${
        Number(productFormData.defaultSpecifications?.bridgeWidthMm) || 18
      }-${Number(productFormData.defaultSpecifications?.templeLengthMm) || 140}`,
    };

    const payload = {
      ...productFormData,
      slug,
      defaultSpecifications: specs,
      defaultPrice: Number(productFormData.defaultPrice) || 35000,
      defaultOriginalPrice: productFormData.defaultOriginalPrice
        ? Number(productFormData.defaultOriginalPrice)
        : undefined,
    };

    setIsSavingProduct(true);

    try {
      if (isCreatingProduct) {
        const res = await apiFetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: payload }),
        });
        const data = await res.json();
        if (res.ok) {
          onSuccess(`Product "${payload.name}" created in Supabase`);
          onClose();
        } else {
          const detailsStr = data.details ? JSON.stringify(data.details.map((d: any) => `${d.path.join('.')}: ${d.message}`)) : '';
          onError(data.error + (detailsStr ? ` - ${detailsStr}` : ''));
        }
      } else if (product) {
        const res = await apiFetch('/api/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: { ...payload, id: product.id } }),
        });
        const data = await res.json();
        if (res.ok) {
          onSuccess(`Product "${payload.name}" updated in Supabase`);
          onClose();
        } else {
          const detailsStr = data.details ? JSON.stringify(data.details.map((d: any) => `${d.path.join('.')}: ${d.message}`)) : '';
          onError(data.error + (detailsStr ? ` - ${detailsStr}` : ''));
        }
      }
    } catch {
      onError('Server error while saving product');
    } finally {
      setIsSavingProduct(false);
    }
  };

  if (!isOpen) return null;

  const hasName = Boolean(productFormData.name && productFormData.name.trim().length >= 2);
  const hasPrice = Boolean(productFormData.defaultPrice && Number(productFormData.defaultPrice) > 0);
  const hasFrontImage = Boolean(
    product ||
    (productFormData.media as any[])?.some(
      (m) => m.url && (m.mediaType === 'image_front' || m.type === 'front'),
    )
  );
  const isValid = hasName && hasPrice && hasFrontImage;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between flex-shrink-0 bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isCreatingProduct ? 'Create New Eyewear Product' : `Edit "${product?.name}"`}
              </h2>
              <p className="text-xs text-neutral-400">
                Fill in product details, pricing, dimensions, and photos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="productForm" onSubmit={handleSaveProduct} className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 custom-scrollbar text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold flex items-center justify-between">
                <span>Product Name *</span>
                {(!productFormData.name || productFormData.name.trim().length < 2) && (
                  <span className="text-[10px] text-amber-400 font-normal">Required</span>
                )}
              </label>
              <input
                type="text"
                required
                value={productFormData.name || ''}
                onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                placeholder="e.g. Classic Havana"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400 font-semibold">Slug (URL identifier)</label>
              <input
                type="text"
                value={productFormData.slug || ''}
                onChange={(e) => setProductFormData({ ...productFormData, slug: e.target.value })}
                placeholder="e.g. classic-havana"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400 font-semibold">Category *</label>
              <select
                value={productFormData.category || 'unisex'}
                onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              >
                <option value="unisex">Unisex Eyewear</option>
                <option value="men">Men's Optical</option>
                <option value="women">Women's Optical</option>
                <option value="sunglasses">Designer Sunglasses</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400 font-semibold">Catalog Status</label>
              <select
                value={productFormData.status || 'ACTIVE'}
                onChange={(e) => setProductFormData({ ...productFormData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              >
                <option value="ACTIVE">Active (Live in Shop)</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold flex items-center justify-between">
                <span>Default Price (₦) *</span>
                {(!productFormData.defaultPrice || Number(productFormData.defaultPrice) <= 0) && (
                  <span className="text-[10px] text-amber-400 font-normal">Must be &gt; 0</span>
                )}
              </label>
              <input
                type="number"
                required
                min="1"
                value={productFormData.defaultPrice || ''}
                onChange={(e) => setProductFormData({ ...productFormData, defaultPrice: Number(e.target.value) })}
                placeholder="35000"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400 font-semibold">Original Price (₦ Optional)</label>
              <input
                type="number"
                value={productFormData.defaultOriginalPrice || ''}
                onChange={(e) =>
                  setProductFormData({
                    ...productFormData,
                    defaultOriginalPrice: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="42000"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400 font-semibold">Material</label>
              <input
                type="text"
                value={productFormData.defaultMaterial || ''}
                onChange={(e) => setProductFormData({ ...productFormData, defaultMaterial: e.target.value })}
                placeholder="Cellulose Acetate"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400 font-semibold">Weight</label>
              <input
                type="text"
                value={productFormData.defaultWeight || ''}
                onChange={(e) => setProductFormData({ ...productFormData, defaultWeight: e.target.value })}
                placeholder="22g"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2.5">
            <span className="text-[11px] font-bold text-brand-400 block">Optical Dimensions (mm)</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-neutral-400">Lens Width</label>
                <input
                  type="number"
                  value={productFormData.defaultSpecifications?.lensWidthMm || 52}
                  onChange={(e) =>
                    setProductFormData({
                      ...productFormData,
                      defaultSpecifications: {
                        ...(productFormData.defaultSpecifications as any),
                        lensWidthMm: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400">Bridge Width</label>
                <input
                  type="number"
                  value={productFormData.defaultSpecifications?.bridgeWidthMm || 18}
                  onChange={(e) =>
                    setProductFormData({
                      ...productFormData,
                      defaultSpecifications: {
                        ...(productFormData.defaultSpecifications as any),
                        bridgeWidthMm: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400">Temple Length</label>
                <input
                  type="number"
                  value={productFormData.defaultSpecifications?.templeLengthMm || 140}
                  onChange={(e) =>
                    setProductFormData({
                      ...productFormData,
                      defaultSpecifications: {
                        ...(productFormData.defaultSpecifications as any),
                        templeLengthMm: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400">Total Frame Width</label>
                <input
                  type="number"
                  value={productFormData.defaultSpecifications?.frameWidthMm || 140}
                  onChange={(e) =>
                    setProductFormData({
                      ...productFormData,
                      defaultSpecifications: {
                        ...(productFormData.defaultSpecifications as any),
                        frameWidthMm: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-400 block">Product Photos (Front, Side, On-Model)</span>
                <span className="text-[10px] text-neutral-500">Front view is required for store catalog display</span>
              </div>
              {isUploadingImage && (
                <span className="text-brand-400 text-xs flex items-center gap-1.5 bg-brand-950/80 px-2.5 py-1 rounded-lg border border-brand-800/60">
                  <div className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                  Uploading {isUploadingImage}...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['front', 'side', 'lifestyle'] as const).map((imageType) => {
                const media = (productFormData.media as any[])?.find(
                  (m) => m.mediaType === `image_${imageType}` || m.type === imageType,
                );
                return (
                  <div key={imageType} className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition ${
                    media?.url ? 'bg-neutral-900/80 border-emerald-500/40' : 'bg-neutral-900/40 border-neutral-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-200 capitalize">📷 {imageType} View {imageType === 'front' && '*'}</span>
                      {media?.url ? (
                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded">✓ Uploaded</span>
                      ) : (
                        imageType === 'front' && <span className="text-[9px] text-amber-400 font-semibold">Required</span>
                      )}
                    </div>
                    {media?.url && (
                      <div className="relative w-full h-20 rounded-lg overflow-hidden border border-neutral-800 bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={media.url} alt={`${imageType} View`} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <label className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition shadow-sm">
                      <Upload className="w-3.5 h-3.5 text-brand-400" />
                      <span>{media?.url ? 'Replace Photo' : `Upload ${imageType}`}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!!isUploadingImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f, imageType);
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-neutral-400 font-semibold">Description</label>
            <textarea
              rows={3}
              value={productFormData.description || ''}
              onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
              placeholder="Detailed customer-facing product description..."
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={productFormData.tryOnAvailable ?? true}
                onChange={(e) => setProductFormData({ ...productFormData, tryOnAvailable: e.target.checked })}
                className="rounded bg-neutral-950 border-neutral-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="text-neutral-300">Virtual Try-On Enabled</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={productFormData.prescriptionRequired ?? true}
                onChange={(e) => setProductFormData({ ...productFormData, prescriptionRequired: e.target.checked })}
                className="rounded bg-neutral-950 border-neutral-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="text-neutral-300">Prescription Ready</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={productFormData.hideWhenOutOfStock ?? true}
                onChange={(e) => setProductFormData({ ...productFormData, hideWhenOutOfStock: e.target.checked })}
                className="rounded bg-neutral-950 border-neutral-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="text-neutral-300">Auto-Hide from Store when Out of Stock</span>
            </label>
          </div>
        </form>

        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs">
            {!isValid ? (
              <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {!hasName ? 'Enter Product Name' : !hasPrice ? 'Enter Valid Price' : 'Upload Front View photo to save'}
                </span>
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <span>✓ Ready to save to Supabase</span>
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="productForm"
              disabled={isSavingProduct || !isValid}
              className="px-6 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-brand-900/30 flex items-center gap-2"
            >
              {isSavingProduct && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isCreatingProduct ? 'Create Product' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
