'use client';

import React, { useEffect, useState } from 'react';
import { Palette, X, Plus, Trash2, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { ResolvedProduct, ProductVariant } from '@/lib/commerce/types';

interface VariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ResolvedProduct | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

interface VtoAssetOption {
  assetId: string;
  name: string;
  status: string;
  physicalWidthMm: number | null;
  lensWidthMm: number | null;
  bridgeWidthMm: number | null;
  attachable: boolean;
}

const emptyVariant: Partial<ProductVariant> = {
  name: '', slug: '', sku: '', colorName: '', colorHex: '#000000',
  inStock: true, stockLevel: 'high', unitsInStock: 20,
  vtoAssetId: '', status: 'ACTIVE',
};

export default function VariantModal({ isOpen, onClose, product, onSuccess, onError }: VariantModalProps) {
  const [newVariantData, setNewVariantData] = useState<Partial<ProductVariant>>(emptyVariant);
  const [assets, setAssets] = useState<VtoAssetOption[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isSavingVariant, setIsSavingVariant] = useState(false);

  const loadAssets = async () => {
    setIsLoadingAssets(true);
    try {
      const res = await apiFetch('/api/vto-assets');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load VTO assets');
      setAssets(data.assets || []);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load VTO assets');
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => {
    if (isOpen && product) loadAssets();
  }, [isOpen, product?.id]);

  if (!isOpen || !product) return null;

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVariantData.colorName?.trim()) return onError('Color name is required');
    if (!newVariantData.vtoAssetId?.trim()) return onError('A published VTO asset must be selected before adding this variant');

    const varSlug = newVariantData.slug?.trim() || newVariantData.colorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const sku = newVariantData.sku?.trim() || `${product.slug.slice(0, 3).toUpperCase()}-${varSlug.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-2)}`;

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
      vtoAssetId: newVariantData.vtoAssetId.trim(),
      sortOrder: product.variants.length + 1,
      status: 'ACTIVE',
    };

    setIsSavingVariant(true);
    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_VARIANT', variant: variantPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add variant');
      onSuccess(`Variant "${variantPayload.colorName}" added with authoritative VTO asset`);
      setNewVariantData({ ...emptyVariant });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Server error adding variant');
    } finally {
      setIsSavingVariant(false);
    }
  };

  const handleUpdateVariantStock = async (variant: ProductVariant, inStock: boolean) => {
    try {
      const res = await apiFetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_VARIANT',
          variant: {
            id: variant.id,
            productId: variant.productId,
            slug: variant.slug,
            name: variant.name,
            sku: variant.sku,
            colorName: variant.colorName,
            colorHex: variant.colorHex,
            vtoAssetId: variant.vtoAssetId,
            inStock,
            stockLevel: variant.stockLevel,
            unitsInStock: inStock ? (variant.unitsInStock || 15) : 0,
            sortOrder: variant.sortOrder,
            status: variant.status,
          },
        }),
      });
      if (!res.ok) throw new Error('Error updating stock');
      onSuccess('Variant stock updated');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error updating stock');
    }
  };

  const handleDeleteVariant = async (variantId: string, colorName: string) => {
    if (!confirm(`Delete variant "${colorName}"?`)) return;
    try {
      const res = await apiFetch(`/api/products?type=variant&id=${variantId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error deleting variant');
      onSuccess('Variant deleted');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error deleting variant');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center"><Palette className="w-5 h-5" /></div>
            <div><h2 className="text-lg font-bold text-white">Variants & Colors: {product.name}</h2><p className="text-xs text-neutral-400">Manage variants, stock, pricing, and authoritative VTO asset identity.</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-neutral-800 text-neutral-300"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          <div className="space-y-3">
            <span className="text-xs font-bold text-neutral-300 block">Active Variants ({product.variants.length})</span>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {product.variants.map((v) => (
                <div key={v.id} className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full border border-black/40" style={{ backgroundColor: v.colorHex }} />
                    <div><div className="font-bold text-white">{v.colorName} <span className="font-mono text-[10px] text-neutral-400">({v.sku})</span></div><div className="text-[11px] text-neutral-400">₦{v.effectivePrice.toLocaleString()} · {v.unitsInStock ?? 0} in stock</div></div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button type="button" onClick={() => handleUpdateVariantStock(v, !v.inStock)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${v.inStock ? 'text-emerald-300 border-emerald-500/30' : 'text-red-300 border-red-500/30'}`}>{v.inStock ? 'In Stock' : 'Out of Stock'}</button>
                    {v.vtoAssetId ? <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-800 rounded text-[10px] font-bold">VTO Linked</span> : <span className="px-2 py-0.5 bg-red-900/30 text-red-300 border border-red-800 rounded text-[10px] font-bold">No VTO</span>}
                    <button type="button" onClick={() => handleDeleteVariant(v.id, v.colorName)} className="p-1.5 text-neutral-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddVariant} className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4 text-xs">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Plus className="w-4 h-4 text-brand-400" /><span className="font-bold text-white">Add New Color Variant</span></div><button type="button" onClick={loadAssets} disabled={isLoadingAssets} className="text-neutral-400 hover:text-white"><RefreshCw className={`w-4 h-4 ${isLoadingAssets ? 'animate-spin' : ''}`} /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div><label className="text-neutral-400">Color Name *</label><input required value={newVariantData.colorName || ''} onChange={(e) => setNewVariantData({ ...newVariantData, colorName: e.target.value })} className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white" /></div>
              <div><label className="text-neutral-400">Color Hex</label><input value={newVariantData.colorHex || ''} onChange={(e) => setNewVariantData({ ...newVariantData, colorHex: e.target.value })} className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono" /></div>
              <div><label className="text-neutral-400">Units in Stock *</label><input required type="number" min="0" value={newVariantData.unitsInStock ?? 10} onChange={(e) => setNewVariantData({ ...newVariantData, unitsInStock: Math.max(0, Number(e.target.value) || 0), inStock: Number(e.target.value) > 0 })} className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono" /></div>
              <div><label className="text-neutral-400">Price Override (₦)</label><input type="number" value={newVariantData.priceOverride || ''} onChange={(e) => setNewVariantData({ ...newVariantData, priceOverride: e.target.value ? Number(e.target.value) : undefined })} className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white" /></div>
            </div>
            <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 space-y-2">
              <label className="text-neutral-300 font-semibold">Authoritative VTO Asset *</label>
              <select required value={newVariantData.vtoAssetId || ''} onChange={(e) => setNewVariantData({ ...newVariantData, vtoAssetId: e.target.value })} className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white">
                <option value="">Select a PUBLISHED VTO asset</option>
                {assets.map((asset) => <option key={asset.assetId} value={asset.assetId} disabled={!asset.attachable}>{asset.name} · {asset.status} · {asset.assetId}</option>)}
              </select>
              <p className="text-[10px] text-neutral-500">Only PUBLISHED assets can be attached to a product variant. Raw GLB paths are no longer accepted as catalog identity.</p>
              {assets.length === 0 && !isLoadingAssets && <p className="text-[10px] text-amber-400">No VTO assets found. Create and publish the asset through the authoritative VTO pipeline first.</p>}
            </div>
            <div className="flex justify-end pt-2"><button type="submit" disabled={isSavingVariant || !newVariantData.vtoAssetId} className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /><span>{isSavingVariant ? 'Saving...' : 'Add Variant'}</span></button></div>
          </form>
        </div>

        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between"><span className="text-xs text-neutral-400">{product.variants.length} colorway(s) configured</span><button type="button" onClick={onClose} className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold text-xs">Close Manager</button></div>
      </div>
    </div>
  );
}
