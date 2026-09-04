'use client';
import { apiFetch } from '@/lib/api-client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Filter, Package, Palette, Trash2, Edit2, ExternalLink, RefreshCw } from 'lucide-react';
import { ResolvedProduct } from '@/lib/commerce/types';
import ProductModal from '@/components/ProductModal';
import VariantModal from '@/components/VariantModal';

// Shared store URL for live shop links
const storeUrl = process.env.NEXT_PUBLIC_STORE_URL || 'http://localhost:3000';

export default function ProductsPage() {
  const [products, setProducts] = useState<ResolvedProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('ALL');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ResolvedProduct | null>(null);
  const [managingVariantsProduct, setManagingVariantsProduct] = useState<ResolvedProduct | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const res = await apiFetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        const freshList: ResolvedProduct[] = data.products || [];
        setProducts(freshList);
        try {
          localStorage.setItem('mcdaves_admin_cached_products', JSON.stringify(freshList));
        } catch {}

        setManagingVariantsProduct((cur) => {
          if (!cur) return null;
          return freshList.find((p) => p.id === cur.id) || null;
        });
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('mcdaves_admin_cached_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
        }
      }
    } catch {}
    loadProducts();
  }, [loadProducts]);

  const handleDeleteProduct = async (product: ResolvedProduct) => {
    if (
      !confirm(
        `Are you sure you want to delete "${product.name}" and all its ${product.variants.length} variant(s)?`,
      )
    ) {
      return;
    }

    const previousProducts = [...products];
    setProducts((prev) => prev.filter((p) => p.id !== product.id));

    try {
      const res = await apiFetch(`/api/products?id=${product.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Product "${product.name}" deleted`);
      } else {
        setProducts(previousProducts);
        showToast('Failed to delete product from database', 'error');
      }
    } catch {
      setProducts(previousProducts);
      showToast('Network error while deleting product', 'error');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (productStatusFilter !== 'ALL' && p.status !== productStatusFilter) return false;
    if (productSearch) {
      const q = productSearch.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.slug || '').toLowerCase().includes(q) ||
        (p.defaultMaterial || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-neutral-950 text-neutral-200">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold border animate-in slide-in-from-bottom-5 ${
              toastMessage.type === 'error'
                ? 'bg-red-950/90 border-red-900/50 text-red-200'
                : 'bg-emerald-950/90 border-emerald-900/50 text-emerald-200'
            }`}
          >
            {toastMessage.type === 'error' ? '⚠️' : '✅'}
            {toastMessage.text}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 flex-shrink-0 px-4 sm:px-8 py-5 border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-12 lg:ml-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-brand-500" />
              Products & Inventory
            </h1>
            <p className="text-xs text-neutral-500 mt-1 max-w-lg">
              Manage eyewear catalog, 3D VTO models, and real-time inventory.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadProducts}
              disabled={isLoadingProducts}
              className="flex items-center justify-center gap-2 p-2.5 sm:px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/60 rounded-xl text-neutral-300 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-sm font-medium">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-8 space-y-6 overflow-y-auto">
        <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-3xl p-4 sm:p-6 backdrop-blur-sm shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  id="product-search"
                  name="product-search"
                  type="text"
                  placeholder="Search catalog..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 bg-neutral-950/50 border border-neutral-800 rounded-xl text-sm focus:outline-none focus:border-brand-500 text-white transition-all placeholder:text-neutral-600 shadow-inner"
                />
              </div>


              <div className="relative">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                <select
                  id="product-status-filter"
                  name="product-status-filter"
                  value={productStatusFilter}
                  onChange={(e) => setProductStatusFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs font-semibold text-neutral-300 focus:outline-none focus:border-brand-500 appearance-none shadow-inner"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active (Live)</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setIsCreatingProduct(true)}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-900/20 hover:shadow-brand-900/40 active:scale-95 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Product</span>
            </button>
          </div>

          {isLoadingProducts && products.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
              <p className="text-neutral-500 text-sm animate-pulse">Syncing catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center bg-neutral-950 rounded-2xl border border-neutral-900 shadow-inner">
              <Package className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">No products found</h3>
              <p className="text-sm text-neutral-500">
                {productSearch ? 'Try a different search term.' : 'Click "New Product" to build your catalog.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 hover:border-neutral-700 transition-colors shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">
                        {product.name}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1 font-mono">
                        {product.slug}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
                        product.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : product.status === 'DRAFT'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-lg font-black text-white">
                        ₦{product.defaultPrice.toLocaleString()}
                      </div>
                      {product.defaultOriginalPrice && (
                        <div className="text-xs text-neutral-500 line-through mt-0.5">
                          ₦{product.defaultOriginalPrice.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider mb-1">
                        Stock Logic
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-neutral-300">Live Sync</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400 font-semibold flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5" /> Variants
                      </span>
                      <button
                        onClick={() => setManagingVariantsProduct(product)}
                        className="text-brand-400 hover:text-brand-300 font-bold transition flex items-center gap-1"
                      >
                        Manage <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-neutral-800"
                          title={`${v.colorName} (${v.sku})`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/40 flex-shrink-0"
                            style={{ backgroundColor: v.colorHex }}
                          />
                          <span className="text-neutral-200 font-medium text-[10px]">{v.colorName}</span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              v.inStock ? 'bg-emerald-400' : 'bg-red-400'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Edit2 className="w-3 h-3 text-neutral-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="p-1.5 bg-neutral-800 hover:bg-red-950/60 text-neutral-400 hover:text-red-400 rounded-xl transition"
                        title="Delete product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <a
                      href={`${storeUrl}/shop/${product.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition"
                    >
                      <span>Live Shop</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ProductModal
        isOpen={isCreatingProduct || !!editingProduct}
        onClose={() => {
          setIsCreatingProduct(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSuccess={(msg) => {
          showToast(msg);
          loadProducts();
        }}
        onError={(msg) => showToast(msg, 'error')}
      />

      <VariantModal
        isOpen={!!managingVariantsProduct}
        onClose={() => setManagingVariantsProduct(null)}
        product={managingVariantsProduct}
        onSuccess={(msg) => {
          showToast(msg);
          loadProducts();
        }}
        onError={(msg) => showToast(msg, 'error')}
      />
    </div>
  );
}
