'use client';

import React, { useState } from 'react';
import { Palette, X, Plus, Sparkles, Trash2 } from 'lucide-react';
import { ResolvedProduct, ProductVariant } from '@/lib/commerce/types';

interface VariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ResolvedProduct | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function VariantModal({ isOpen, onClose, product, onSuccess, onError }: VariantModalProps) {
  const [newVariantData, setNewVariantData] = useState<Partial<ProductVariant>>({
    name: '',
    slug: '',
    sku: '',
    colorName: '',
    colorHex: '#000000',
    inStock: true,
    stockLevel: 'high',
    unitsInStock: 20,
    glbPath: '',
    status: 'ACTIVE',
  });
  
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  const [isUploadingGlb, setIsUploadingGlb] = useState(false);
  const [isGeneratingGlb, setIsGeneratingGlb] = useState(false);

  if (!isOpen || !product) return null;

  const handleGlbFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.glb')) {
      onError('Please select a valid .glb 3D model file');
      return;
    }

    setIsUploadingGlb(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-model', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.glbPath) {
        setNewVariantData((prev) => ({ ...prev, glbPath: data.glbPath }));
        onSuccess(
          data.compressionSummary
            ? `3D Model Optimized! ${data.compressionSummary}`
            : `Uploaded 3D Model: ${data.filename}`,
        );
      } else {
        onError(data.error || 'Failed to upload 3D model');
      }
    } catch {
      onError('Network error uploading 3D model');
    } finally {
      setIsUploadingGlb(false);
    }
  };

  const handleGenerateGlbModel = async () => {
    setIsGeneratingGlb(true);
    try {
      const res = await fetch('/api/generate-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          variantName: newVariantData.colorName || 'Variant',
          colorHex: newVariantData.colorHex || '#1A1A1A',
          style: product.slug?.includes('cat-eye')
            ? 'cat-eye'
            : product.slug?.includes('aviator')
            ? 'aviator'
            : 'round',
          frameWidthMm: product.defaultSpecifications?.frameWidthMm || 140,
          lensWidthMm: product.defaultSpecifications?.lensWidthMm || 50,
          bridgeWidthMm: product.defaultSpecifications?.bridgeWidthMm || 18,
        }),
      });

      const data = await res.json();
      if (res.ok && data.glbPath) {
        setNewVariantData((prev) => ({ ...prev, glbPath: data.glbPath }));
        onSuccess(`✨ 3D Model Generated: ${data.summary || data.filename}`);
      } else {
        onError(data.error || 'Failed to generate 3D model');
      }
    } catch {
      onError('Error connecting to 3D generator engine');
    } finally {
      setIsGeneratingGlb(false);
    }
  };

  const handleConvertImageToGlb = async (file: File) => {
    setIsGeneratingGlb(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('productName', product.name);
      formData.append('variantName', newVariantData.colorName || 'Variant');
      formData.append(
        'frameWidthMm',
        String(product.defaultSpecifications?.frameWidthMm || 140),
      );

      const res = await fetch('/api/generate-model', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.glbPath) {
        setNewVariantData((prev) => ({ ...prev, glbPath: data.glbPath }));
        onSuccess(`📸 Converted Image ➔ 3D GLB: ${data.summary || data.filename}`);
      } else {
        onError(data.error || 'Failed to convert image to 3D GLB');
      }
    } catch {
      onError('Error connecting to Image-to-3D engine');
    } finally {
      setIsGeneratingGlb(false);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVariantData.colorName?.trim()) {
      onError('Color name is required');
      return;
    }

    const varSlug =
      newVariantData.slug?.trim() ||
      newVariantData.colorName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    const sku =
      newVariantData.sku?.trim() ||
      `${product.slug.slice(0, 3).toUpperCase()}-${varSlug.slice(0, 3).toUpperCase()}-${Date.now()
        .toString()
        .slice(-2)}`;

    const variantPayload: Omit<ProductVariant, 'createdAt' | 'updatedAt'> = {
      id: `var-${product.id}-${varSlug}-${Date.now().toString().slice(-3)}`,
      productId: product.id,
      name: `${product.name} - ${newVariantData.colorName}`,
      slug: varSlug,
      sku,
      colorName: newVariantData.colorName.trim(),
      colorHex: newVariantData.colorHex || '#000000',
      priceOverride: newVariantData.priceOverride ? Number(newVariantData.priceOverride) : undefined,
      inStock: newVariantData.inStock ?? true,
      stockLevel: newVariantData.stockLevel || 'high',
      unitsInStock: Number(newVariantData.unitsInStock) || 10,
      glbPath: newVariantData.glbPath?.trim() || undefined,
      sortOrder: product.variants.length + 1,
      status: 'ACTIVE',
    };

    setIsSavingVariant(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_VARIANT', variant: variantPayload }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(`Variant "${variantPayload.colorName}" added to Supabase`);
        setNewVariantData({
          name: '',
          slug: '',
          sku: '',
          colorName: '',
          colorHex: '#000000',
          inStock: true,
          stockLevel: 'high',
          unitsInStock: 20,
          glbPath: '',
          status: 'ACTIVE',
        });
      } else {
        onError(data.error || 'Failed to add variant');
      }
    } catch {
      onError('Server error adding variant');
    } finally {
      setIsSavingVariant(false);
    }
  };

  const handleUpdateVariantStock = async (variant: ProductVariant, inStock: boolean) => {
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_VARIANT',
          variant: { id: variant.id, in_stock: inStock, units_in_stock: inStock ? (variant.unitsInStock || 15) : 0 },
        }),
      });
      if (res.ok) {
        onSuccess(`Variant stock updated in Supabase`);
      }
    } catch {
      onError('Error updating stock');
    }
  };

  const handleDeleteVariant = async (variantId: string, colorName: string) => {
    if (!confirm(`Delete variant "${colorName}"?`)) return;

    try {
      const res = await fetch(`/api/products?type=variant&id=${variantId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onSuccess(`Variant deleted`);
      } else {
        onError('Error deleting variant');
      }
    } catch {
      onError('Error deleting variant');
    }
  };

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
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Variants & Colors: {product.name}
              </h2>
              <p className="text-xs text-neutral-400">
                Manage colorways, stock quantities, price overrides, and 3D VTO models
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          <div className="space-y-3">
            <span className="text-xs font-bold text-neutral-300 block">
              Active Variants ({product.variants.length})
            </span>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {product.variants.map((v) => (
                <div
                  key={v.id}
                  className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-5 h-5 rounded-full border border-black/40 flex-shrink-0 shadow-inner"
                      style={{ backgroundColor: v.colorHex }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{v.colorName}</span>
                        <span className="font-mono text-[10px] text-neutral-400">
                          ({v.sku})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-neutral-400">
                          ₦{v.effectivePrice.toLocaleString()}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-[11px] font-semibold text-brand-400">
                          📦 {v.unitsInStock ?? (v.inStock ? 10 : 0)} in stock
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = v.unitsInStock ?? 10;
                          const next = Math.max(0, cur - 1);
                          handleUpdateVariantStock(v, next > 0);
                        }}
                        className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="px-2 font-mono font-bold text-white text-xs">
                        {v.unitsInStock ?? (v.inStock ? 10 : 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateVariantStock(v, true);
                        }}
                        className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpdateVariantStock(v, !v.inStock)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                        v.inStock
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30'
                      }`}
                    >
                      {v.inStock ? 'In Stock' : 'Out of Stock'}
                    </button>

                    {v.glbPath ? (
                      <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-800 rounded text-[10px] font-bold">
                        3D Model Attached
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded text-[10px]">
                        No 3D Model
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteVariant(v.id, v.colorName)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition"
                      title="Delete variant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddVariant}
            className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-400" />
              <span className="font-bold text-white text-xs">Add New Color Variant</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-neutral-400">Color Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Matte Tortoise"
                  value={newVariantData.colorName || ''}
                  onChange={(e) => setNewVariantData({ ...newVariantData, colorName: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400">Color Hex Code</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newVariantData.colorHex || '#000000'}
                    onChange={(e) => setNewVariantData({ ...newVariantData, colorHex: e.target.value })}
                    className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-700 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    placeholder="#4A3728"
                    value={newVariantData.colorHex || ''}
                    onChange={(e) => setNewVariantData({ ...newVariantData, colorHex: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400">Units in Stock (Qty) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 15"
                  value={newVariantData.unitsInStock ?? 10}
                  onChange={(e) =>
                    setNewVariantData({
                      ...newVariantData,
                      unitsInStock: Math.max(0, parseInt(e.target.value, 10) || 0),
                      inStock: (parseInt(e.target.value, 10) || 0) > 0,
                    })
                  }
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400">Price Override (Optional ₦)</label>
                <input
                  type="number"
                  placeholder="Inherits base price"
                  value={newVariantData.priceOverride || ''}
                  onChange={(e) =>
                    setNewVariantData({
                      ...newVariantData,
                      priceOverride: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="space-y-2 p-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
              <label className="text-neutral-300 font-semibold flex items-center justify-between">
                <span>3D GLB Model (for AR Virtual Try-On)</span>
                {isUploadingGlb && (
                  <span className="text-brand-400 text-[10px] flex items-center gap-1">
                    <div className="w-2.5 h-2.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    Processing 3D Model...
                  </span>
                )}
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="/models/glasses.glb"
                  value={newVariantData.glbPath || ''}
                  onChange={(e) => setNewVariantData({ ...newVariantData, glbPath: e.target.value })}
                  className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-[11px]"
                />

                <label className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition flex-shrink-0 active:scale-95">
                  {isGeneratingGlb ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>📸 Image ➔ 3D GLB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={isGeneratingGlb || isUploadingGlb}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleConvertImageToGlb(f);
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleGenerateGlbModel}
                  disabled={isGeneratingGlb || isUploadingGlb}
                  className="px-3.5 py-2 bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition flex-shrink-0 active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <span>✨ Parametric 3D</span>
                </button>

                <label className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upload .glb</span>
                  <input
                    type="file"
                    accept=".glb"
                    className="hidden"
                    disabled={isUploadingGlb || isGeneratingGlb}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleGlbFileUpload(f);
                    }}
                  />
                </label>
              </div>
              <p className="text-[10px] text-neutral-500">
                Select <b>📸 Image ➔ 3D GLB</b> to convert any front photo of glasses into a clipped 3D model, or click <b>Parametric 3D</b> to generate from specs.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingVariant || isUploadingGlb || isGeneratingGlb}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variant</span>
              </button>
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-neutral-400">
            {product.variants.length} colorway(s) configured
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold transition text-xs shadow-md"
          >
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
}
