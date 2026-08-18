// src/app/page.tsx
/**
 * McDaves Dedicated Admin Console
 * Subdomain: iamadmin.mcdaves.com.ng
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  ShoppingBag,
  Package,
  Sparkles,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  CreditCard,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  X,
  Palette,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowUpRight,
} from 'lucide-react';
import {
  OrderIntent,
  OrderIntentStatus,
  Order,
  ResolvedProduct,
  Product,
  ProductVariant,
  PhysicalSpecifications,
} from '@/lib/commerce/types';

type AdminTab = 'intents' | 'orders' | 'products';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('intents');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Check auth session
  useEffect(() => {
    async function verifySession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    }
    verifySession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setAuthError('Please enter the administrator passkey.');
      return;
    }

    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: passcode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setPasscode('');
        setAuthError(null);
        showToast('Administrator session authenticated');
      } else {
        setAuthError(data.error || 'Incorrect administrator passkey. Access denied.');
      }
    } catch {
      setAuthError('Unable to connect to authentication server. Please retry.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setIsAuthenticated(false);
    setPasscode('');
    showToast('Logged out successfully', 'info');
  };

  // Order Intents State
  const [intents, setIntents] = useState<OrderIntent[]>([]);
  const [intentSearch, setIntentSearch] = useState('');
  const [intentStatusFilter, setIntentStatusFilter] = useState('ALL');
  const [isLoadingIntents, setIsLoadingIntents] = useState(false);
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Confirmed Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Products State
  const [products, setProducts] = useState<ResolvedProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('ALL');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Product Modals State
  const [editingProduct, setEditingProduct] = useState<ResolvedProduct | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productFormData, setProductFormData] = useState<Partial<Product & { media?: any[] }>>({});
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Variant Modal State
  const [managingVariantsProduct, setManagingVariantsProduct] = useState<ResolvedProduct | null>(null);
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

  const handleGlbFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.glb')) {
      showToast('Please select a valid .glb 3D model file', 'error');
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
        showToast(
          data.compressionSummary
            ? `3D Model Optimized! ${data.compressionSummary}`
            : `Uploaded 3D Model: ${data.filename}`,
        );
      } else {
        showToast(data.error || 'Failed to upload 3D model', 'error');
      }
    } catch {
      showToast('Network error uploading 3D model', 'error');
    } finally {
      setIsUploadingGlb(false);
    }
  };

  const [isUploadingImage, setIsUploadingImage] = useState<string | null>(null);

  const handleImageUpload = async (file: File, imageType: 'front' | 'side' | 'lifestyle') => {
    setIsUploadingImage(imageType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', imageType);

      const res = await fetch('/api/upload-image', {
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
        showToast(`Uploaded ${imageType} view photo!`);
      } else {
        showToast(data.error || 'Failed to upload photo', 'error');
      }
    } catch {
      showToast('Network error uploading photo', 'error');
    } finally {
      setIsUploadingImage(null);
    }
  };

  // Load Intents
  const loadIntents = useCallback(async () => {
    setIsLoadingIntents(true);
    try {
      const url = new URL('/api/order-intents', window.location.origin);
      if (intentStatusFilter !== 'ALL') url.searchParams.set('status', intentStatusFilter);
      if (intentSearch) url.searchParams.set('search', intentSearch);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setIntents(data.intents || []);
      }
    } catch (err) {
      console.error('Failed to load order intents:', err);
    } finally {
      setIsLoadingIntents(false);
    }
  }, [intentStatusFilter, intentSearch]);

  // Load Orders
  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const url = new URL('/api/orders', window.location.origin);
      if (orderSearch) url.searchParams.set('search', orderSearch);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [orderSearch]);

  // Load Products
  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        if (managingVariantsProduct) {
          const fresh = (data.products || []).find(
            (p: ResolvedProduct) => p.id === managingVariantsProduct.id,
          );
          if (fresh) setManagingVariantsProduct(fresh);
        }
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [managingVariantsProduct]);

  useEffect(() => {
    if (activeTab === 'intents') loadIntents();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'products') loadProducts();
  }, [activeTab, loadIntents, loadOrders, loadProducts]);

  // Update intent status
  const handleUpdateIntentStatus = async (id: string, newStatus: OrderIntentStatus) => {
    try {
      const res = await fetch(`/api/order-intents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        loadIntents();
        showToast(`Lead status updated to ${newStatus}`);
      }
    } catch {
      showToast('Failed to update lead status', 'error');
    }
  };

  // Generate Paystack Link for Intent
  const handleGeneratePaymentLink = async (intentId: string) => {
    setGeneratingLinkFor(intentId);
    try {
      const res = await fetch(`/api/order-intents/${intentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatePaymentLink: true }),
      });
      if (res.ok) {
        const data = await res.json();
        loadIntents();
        if (data.intent?.payment_link_url) {
          navigator.clipboard.writeText(data.intent.payment_link_url);
          setCopiedLinkId(intentId);
          showToast('Payment link generated and copied to clipboard');
          setTimeout(() => setCopiedLinkId(null), 3000);
        }
      }
    } catch {
      showToast('Failed to generate payment link', 'error');
    } finally {
      setGeneratingLinkFor(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLinkId(id);
    showToast('Copied to clipboard');
    setTimeout(() => setCopiedLinkId(null), 3000);
  };

  // ─── PRODUCT MANAGEMENT HANDLERS ──────────────────────────────────────────

  const openCreateProductModal = () => {
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
    setIsCreatingProduct(true);
  };

  const openEditProductModal = (product: ResolvedProduct) => {
    setEditingProduct(product);
    setProductFormData({
      ...product,
      hideWhenOutOfStock: product.hideWhenOutOfStock ?? true,
      features: [...product.features],
      defaultSpecifications: { ...product.defaultSpecifications },
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.name?.trim()) {
      showToast('Product name is required', 'error');
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
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: payload }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`Product "${payload.name}" created in Supabase`);
          setIsCreatingProduct(false);
          loadProducts();
        } else {
          showToast(data.error || 'Failed to create product', 'error');
        }
      } else if (editingProduct) {
        const res = await fetch('/api/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: { ...payload, id: editingProduct.id } }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`Product "${payload.name}" updated in Supabase`);
          setEditingProduct(null);
          loadProducts();
        } else {
          showToast(data.error || 'Failed to update product', 'error');
        }
      }
    } catch {
      showToast('Server error while saving product', 'error');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: ResolvedProduct) => {
    if (
      !confirm(
        `Are you sure you want to delete "${product.name}" and all its ${product.variants.length} variant(s)?`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/products?id=${product.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Product "${product.name}" deleted from Supabase`);
        loadProducts();
      } else {
        showToast('Failed to delete product', 'error');
      }
    } catch {
      showToast('Server error while deleting product', 'error');
    }
  };

  // ─── VARIANT MANAGEMENT HANDLERS ──────────────────────────────────────────

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingVariantsProduct) return;
    if (!newVariantData.colorName?.trim()) {
      showToast('Color name is required', 'error');
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
      `${managingVariantsProduct.slug.slice(0, 3).toUpperCase()}-${varSlug.slice(0, 3).toUpperCase()}-${Date.now()
        .toString()
        .slice(-2)}`;

    const variantPayload: Omit<ProductVariant, 'createdAt' | 'updatedAt'> = {
      id: `var-${managingVariantsProduct.id}-${varSlug}-${Date.now().toString().slice(-3)}`,
      productId: managingVariantsProduct.id,
      name: `${managingVariantsProduct.name} - ${newVariantData.colorName}`,
      slug: varSlug,
      sku,
      colorName: newVariantData.colorName.trim(),
      colorHex: newVariantData.colorHex || '#000000',
      priceOverride: newVariantData.priceOverride ? Number(newVariantData.priceOverride) : undefined,
      inStock: newVariantData.inStock ?? true,
      stockLevel: newVariantData.stockLevel || 'high',
      unitsInStock: Number(newVariantData.unitsInStock) || 10,
      glbPath: newVariantData.glbPath?.trim() || undefined,
      sortOrder: managingVariantsProduct.variants.length + 1,
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
        showToast(`Variant "${variantPayload.colorName}" added to Supabase`);
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
        loadProducts();
      } else {
        showToast(data.error || 'Failed to add variant', 'error');
      }
    } catch {
      showToast('Server error adding variant', 'error');
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
          variant: { id: variant.id, in_stock: inStock, units_in_stock: inStock ? 15 : 0 },
        }),
      });
      if (res.ok) {
        showToast(`Variant stock updated in Supabase`);
        loadProducts();
      }
    } catch {
      showToast('Error updating stock', 'error');
    }
  };

  const handleDeleteVariant = async (variantId: string, colorName: string) => {
    if (!confirm(`Delete variant "${colorName}"?`)) return;

    try {
      const res = await fetch(`/api/products?type=variant&id=${variantId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(`Variant deleted from Supabase`);
        loadProducts();
      } else {
        showToast('Error deleting variant', 'error');
      }
    } catch {
      showToast('Error deleting variant', 'error');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (productStatusFilter !== 'ALL' && p.status !== productStatusFilter) return false;
    if (productSearch) {
      const q = productSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.defaultMaterial.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const storeUrl = process.env.NEXT_PUBLIC_STORE_URL || 'https://mcdaves.com.ng';

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-400">Verifying administrator session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight mb-2">
              iamadmin.mcdaves.com.ng
            </h1>
            <p className="text-xs text-neutral-400">
              Private administrator portal for McDaves Eyewear & Optical Supplies. Please enter your passkey.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter administrator passkey"
              value={passcode}
              disabled={isLoggingIn}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500 text-center tracking-widest placeholder:tracking-normal placeholder:text-neutral-500 disabled:opacity-50"
              autoFocus
            />
            {authError && (
              <p className="text-xs text-red-400 font-medium">{authError}</p>
            )}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-brand-900/30 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Unlock Console</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Floating Feedback Toasts */}
      <div className="fixed top-5 right-5 z-50 space-y-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-3.5 rounded-2xl border text-xs font-semibold shadow-2xl flex items-center gap-2.5 transition-all pointer-events-auto animate-in slide-in-from-right-4 ${
              toast.type === 'error'
                ? 'bg-red-950/90 text-red-200 border-red-800'
                : toast.type === 'info'
                ? 'bg-blue-950/90 text-blue-200 border-blue-800'
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Top Navbar */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center font-black text-white text-sm">
            M
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                iamadmin.mcdaves.com.ng
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Supabase Live
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Private Administration Hub · McDaves Eyewear
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-800 rounded-2xl border border-neutral-700/80">
          <button
            onClick={() => setActiveTab('intents')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'intents'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Order Intents ({intents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Confirmed Orders ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Catalog & Products ({products.length})</span>
          </button>
        </div>

        {/* Live Store Link, Pipeline & Logout */}
        <div className="flex items-center gap-2">
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <span>Live Store</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
          </a>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold transition"
          >
            Lock
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* ── TAB 1: ORDER INTENTS (CRM) ─────────────────────────────────── */}
        {activeTab === 'intents' && (
          <div className="space-y-6">
            
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by customer, phone, product..."
                    value={intentSearch}
                    onChange={(e) => setIntentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <select
                  value={intentStatusFilter}
                  onChange={(e) => setIntentStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New Leads</option>
                  <option value="WHATSAPP_OPENED">WhatsApp Opened</option>
                  <option value="IN_CONVERSATION">In Conversation</option>
                  <option value="CONSULTATION">Consultation</option>
                  <option value="AWAITING_CUSTOMER">Awaiting Customer</option>
                  <option value="PAYMENT_PENDING">Payment Pending</option>
                  <option value="CONVERTED">Converted (Paid)</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>

              <button
                onClick={() => loadIntents()}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 flex items-center gap-1.5 transition ml-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIntents ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Intents Table */}
            <div className="bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
              {intents.length === 0 ? (
                <div className="p-12 text-center text-neutral-500 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-neutral-600" />
                  <p className="text-sm font-semibold">No order intents recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-950/60 text-neutral-400 border-b border-neutral-800 uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-5">Lead / Date</th>
                        <th className="py-3 px-5">Customer Ref</th>
                        <th className="py-3 px-5">Selected Product & Variant</th>
                        <th className="py-3 px-5">Quoted Price</th>
                        <th className="py-3 px-5">CRM Status</th>
                        <th className="py-3 px-5 text-right">Payment Link & Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {intents.map((intent) => (
                        <tr key={intent.id} className="hover:bg-neutral-800/40 transition">
                          <td className="py-4 px-5">
                            <span className="font-mono text-neutral-400 block text-[10px]">
                              {intent.id}
                            </span>
                            <span className="font-bold text-white block text-sm">
                              {intent.customerName}
                            </span>
                            <span className="text-neutral-400 text-[11px]">
                              {intent.customerPhone}
                            </span>
                          </td>

                          <td className="py-4 px-5">
                            <span className="px-2 py-0.5 rounded font-mono font-bold bg-neutral-800 text-brand-400 text-[11px]">
                              {intent.customerId}
                            </span>
                          </td>

                          <td className="py-4 px-5 space-y-1">
                            <span className="font-bold text-white block">
                              {intent.productName}
                            </span>
                            <span className="text-neutral-400 text-[11px] block">
                              {intent.variantName} · Qty: {intent.quantity}
                            </span>
                            {intent.lensRequestId && (
                              <span className="px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[9px] font-bold tracking-wider uppercase inline-block">
                                + Prescription Lens
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-5 font-bold text-white text-sm">
                            ₦{(intent.priceAtIntent * intent.quantity).toLocaleString()}
                          </td>

                          <td className="py-4 px-5">
                            <select
                              value={intent.status}
                              onChange={(e) =>
                                handleUpdateIntentStatus(
                                  intent.id,
                                  e.target.value as OrderIntentStatus,
                                )
                              }
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-950 border border-neutral-700 text-white focus:outline-none focus:border-brand-500"
                            >
                              <option value="NEW">NEW</option>
                              <option value="WHATSAPP_OPENED">WHATSAPP_OPENED</option>
                              <option value="IN_CONVERSATION">IN_CONVERSATION</option>
                              <option value="CONSULTATION">CONSULTATION</option>
                              <option value="AWAITING_CUSTOMER">AWAITING_CUSTOMER</option>
                              <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
                              <option value="CONVERTED">CONVERTED</option>
                              <option value="LOST">LOST</option>
                            </select>
                          </td>

                          <td className="py-4 px-5 text-right space-y-2">
                            {intent.paymentLinkUrl ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() =>
                                    copyToClipboard(intent.paymentLinkUrl!, intent.id)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 text-[11px] font-bold flex items-center gap-1.5 transition ml-auto"
                                >
                                  {copiedLinkId === intent.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-green-400" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy Pay Link</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleGeneratePaymentLink(intent.id)}
                                disabled={generatingLinkFor === intent.id}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition ml-auto shadow-sm"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>
                                  {generatingLinkFor === intent.id
                                    ? 'Generating...'
                                    : 'Generate Pay Link'}
                                </span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: CONFIRMED ORDERS ──────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Order ID, Reference, Customer..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                onClick={() => loadOrders()}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
              {orders.length === 0 ? (
                <div className="p-12 text-center text-neutral-500 space-y-2">
                  <ShoppingBag className="w-8 h-8 mx-auto text-neutral-600" />
                  <p className="text-sm font-semibold">No confirmed paid orders yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-950/60 text-neutral-400 border-b border-neutral-800 uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-5">Order ID & Date</th>
                        <th className="py-3 px-5">Customer Ref</th>
                        <th className="py-3 px-5">Purchased Items</th>
                        <th className="py-3 px-5">Total Paid</th>
                        <th className="py-3 px-5">Paystack Ref</th>
                        <th className="py-3 px-5">Order Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-neutral-800/40 transition">
                          <td className="py-4 px-5">
                            <span className="font-bold text-white font-mono block text-sm">
                              {order.id}
                            </span>
                            <span className="text-[11px] text-neutral-400">
                              {new Date(order.createdAt).toLocaleDateString('en-NG')}
                            </span>
                          </td>

                          <td className="py-4 px-5 font-mono text-brand-400 font-bold">
                            {order.customerId}
                          </td>

                          <td className="py-4 px-5">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="text-neutral-200">
                                {item.productName} ({item.variantName}) × {item.quantity}
                              </div>
                            ))}
                          </td>

                          <td className="py-4 px-5 font-bold text-white text-sm">
                            ₦{order.totalAmount.toLocaleString()}
                          </td>

                          <td className="py-4 px-5 font-mono text-[11px] text-neutral-400">
                            {order.paymentReference}
                          </td>

                          <td className="py-4 px-5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: PRODUCTS & VARIANTS (SUPABASE CRUD SUITE) ─────────────── */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search products by name, slug..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <select
                  value={productStatusFilter}
                  onChange={(e) => setProductStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={() => loadProducts()}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProducts ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={openCreateProductModal}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow-md shadow-brand-900/30"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Product</span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 space-y-4 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 bg-brand-900/40 px-2 py-0.5 rounded">
                        {product.collection} · {product.category}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          product.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : product.status === 'DRAFT'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {product.status}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-white">{product.name}</h3>
                        <span className="text-xs font-bold text-white bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
                          ₦{product.defaultPrice.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 line-clamp-2 mt-1">
                        {product.description}
                      </p>
                    </div>

                    {/* Specs Pills */}
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-300">
                      <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded-md">
                        📏 {product.defaultSpecifications.frameSize}
                      </span>
                      <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded-md">
                        ⚖️ {product.defaultWeight}
                      </span>
                      <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded-md">
                        🧬 {product.defaultMaterial}
                      </span>
                    </div>

                    {/* Variants preview bar */}
                    <div className="pt-3 border-t border-neutral-800/80">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-2">
                        <span className="font-semibold">Variants ({product.variants.length})</span>
                        <button
                          onClick={() => setManagingVariantsProduct(product)}
                          className="text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
                        >
                          <Palette className="w-3 h-3" />
                          <span>Manage</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {product.variants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px]"
                            title={`${v.colorName} (${v.sku})`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-black/40 flex-shrink-0"
                              style={{ backgroundColor: v.colorHex }}
                            />
                            <span className="text-neutral-200 font-medium">{v.colorName}</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                v.inStock ? 'bg-emerald-400' : 'bg-red-400'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditProductModal(product)}
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
          </div>
        )}

      </main>

      {/* ── MODAL: CREATE / EDIT PRODUCT ──────────────────────────────────── */}
      {(isCreatingProduct || editingProduct) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-6 shadow-2xl relative my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  {isCreatingProduct ? 'Create New Eyewear Product' : `Edit "${editingProduct?.name}"`}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsCreatingProduct(false);
                  setEditingProduct(null);
                }}
                className="p-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productFormData.name || ''}
                    onChange={(e) =>
                      setProductFormData({ ...productFormData, name: e.target.value })
                    }
                    placeholder="e.g. Classic Havana"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Slug (URL identifier)</label>
                  <input
                    type="text"
                    value={productFormData.slug || ''}
                    onChange={(e) =>
                      setProductFormData({ ...productFormData, slug: e.target.value })
                    }
                    placeholder="e.g. classic-havana"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Category</label>
                  <select
                    value={productFormData.category || 'unisex'}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="unisex">Unisex</option>
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="sunglasses">Sunglasses</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Status</label>
                  <select
                    value={productFormData.status || 'ACTIVE'}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="ACTIVE">Active (Live in Shop)</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Default Price (₦) *</label>
                  <input
                    type="number"
                    required
                    value={productFormData.defaultPrice || ''}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        defaultPrice: Number(e.target.value),
                      })
                    }
                    placeholder="35000"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Original / Compare Price (₦)</label>
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
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        defaultMaterial: e.target.value,
                      })
                    }
                    placeholder="Cellulose Acetate"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Weight</label>
                  <input
                    type="text"
                    value={productFormData.defaultWeight || ''}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        defaultWeight: e.target.value,
                      })
                    }
                    placeholder="22g"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Physical Dimensions (mm) */}
              <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2.5">
                <span className="text-[11px] font-bold text-brand-400 block">
                  Optical Dimensions (mm)
                </span>
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

              {/* Product Photos (Front, Side, Lifestyle) */}
              <div className="space-y-2 p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-brand-400">
                    Product Photos (Front, Side, On-Model)
                  </span>
                  {isUploadingImage && (
                    <span className="text-brand-400 text-[10px] flex items-center gap-1">
                      <div className="w-2.5 h-2.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                      Uploading {isUploadingImage} photo...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Front View */}
                  <div className="space-y-1.5 p-2.5 bg-neutral-900/60 rounded-xl border border-neutral-800">
                    <label className="text-[10px] font-bold text-neutral-300 block">
                      📷 Front View (Catalog)
                    </label>
                    <input
                      type="text"
                      placeholder="/images/products/.../front.webp"
                      value={
                        (productFormData.media as any[])?.find(
                          (m) => m.mediaType === 'image_front' || m.type === 'front',
                        )?.url || ''
                      }
                      onChange={(e) => {
                        const url = e.target.value;
                        setProductFormData((prev: any) => {
                          const currentMedia = Array.isArray(prev.media) ? [...prev.media] : [];
                          const idx = currentMedia.findIndex(
                            (m: any) => m.mediaType === 'image_front' || m.type === 'front',
                          );
                          const item = {
                            id: `med-${Date.now()}`,
                            url,
                            altText: `${prev.name || 'Product'} Front`,
                            mediaType: 'image_front',
                            isPrimary: true,
                            sortOrder: 0,
                          };
                          if (idx >= 0) currentMedia[idx] = item;
                          else currentMedia.push(item);
                          return { ...prev, media: currentMedia };
                        });
                      }}
                      className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white font-mono text-[10px]"
                    />
                    <label className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition">
                      <span>Upload Front</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f, 'front');
                        }}
                      />
                    </label>
                  </div>

                  {/* Side View */}
                  <div className="space-y-1.5 p-2.5 bg-neutral-900/60 rounded-xl border border-neutral-800">
                    <label className="text-[10px] font-bold text-neutral-300 block">
                      📷 Side / Angle View
                    </label>
                    <input
                      type="text"
                      placeholder="/images/products/.../side.webp"
                      value={
                        (productFormData.media as any[])?.find(
                          (m) => m.mediaType === 'image_side' || m.type === 'side',
                        )?.url || ''
                      }
                      onChange={(e) => {
                        const url = e.target.value;
                        setProductFormData((prev: any) => {
                          const currentMedia = Array.isArray(prev.media) ? [...prev.media] : [];
                          const idx = currentMedia.findIndex(
                            (m: any) => m.mediaType === 'image_side' || m.type === 'side',
                          );
                          const item = {
                            id: `med-${Date.now()}`,
                            url,
                            altText: `${prev.name || 'Product'} Side`,
                            mediaType: 'image_side',
                            isPrimary: false,
                            sortOrder: 1,
                          };
                          if (idx >= 0) currentMedia[idx] = item;
                          else currentMedia.push(item);
                          return { ...prev, media: currentMedia };
                        });
                      }}
                      className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white font-mono text-[10px]"
                    />
                    <label className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition">
                      <span>Upload Side</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f, 'side');
                        }}
                      />
                    </label>
                  </div>

                  {/* Lifestyle / On-Model View */}
                  <div className="space-y-1.5 p-2.5 bg-neutral-900/60 rounded-xl border border-neutral-800">
                    <label className="text-[10px] font-bold text-neutral-300 block">
                      📷 On-Model / Lifestyle
                    </label>
                    <input
                      type="text"
                      placeholder="/images/products/.../lifestyle.webp"
                      value={
                        (productFormData.media as any[])?.find(
                          (m) => m.mediaType === 'image_lifestyle' || m.type === 'lifestyle',
                        )?.url || ''
                      }
                      onChange={(e) => {
                        const url = e.target.value;
                        setProductFormData((prev: any) => {
                          const currentMedia = Array.isArray(prev.media) ? [...prev.media] : [];
                          const idx = currentMedia.findIndex(
                            (m: any) => m.mediaType === 'image_lifestyle' || m.type === 'lifestyle',
                          );
                          const item = {
                            id: `med-${Date.now()}`,
                            url,
                            altText: `${prev.name || 'Product'} Lifestyle`,
                            mediaType: 'image_lifestyle',
                            isPrimary: false,
                            sortOrder: 2,
                          };
                          if (idx >= 0) currentMedia[idx] = item;
                          else currentMedia.push(item);
                          return { ...prev, media: currentMedia };
                        });
                      }}
                      className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-white font-mono text-[10px]"
                    />
                    <label className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition">
                      <span>Upload Model</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f, 'lifestyle');
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-neutral-400 font-semibold">Description</label>
                <textarea
                  rows={3}
                  value={productFormData.description || ''}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, description: e.target.value })
                  }
                  placeholder="Detailed customer-facing product description..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productFormData.tryOnAvailable ?? true}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        tryOnAvailable: e.target.checked,
                      })
                    }
                    className="rounded bg-neutral-950 border-neutral-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <span className="text-neutral-300">Virtual Try-On Enabled</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productFormData.prescriptionRequired ?? true}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        prescriptionRequired: e.target.checked,
                      })
                    }
                    className="rounded bg-neutral-950 border-neutral-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <span className="text-neutral-300">Prescription Ready</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productFormData.hideWhenOutOfStock ?? true}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        hideWhenOutOfStock: e.target.checked,
                      })
                    }
                    className="rounded bg-neutral-950 border-neutral-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <span className="text-neutral-300">Auto-Hide from Store when Out of Stock</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingProduct(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition shadow-lg shadow-brand-900/30 flex items-center gap-2"
                >
                  {isSavingProduct && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{isCreatingProduct ? 'Create Product' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MANAGE VARIANTS ────────────────────────────────────────── */}
      {managingVariantsProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setManagingVariantsProduct(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-3xl w-full p-6 sm:p-7 space-y-6 shadow-2xl relative my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Variants & Colors: {managingVariantsProduct.name}
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Manage colorways, stock quantities, price overrides, and 3D VTO models
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingVariantsProduct(null)}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Existing Variants List */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-neutral-300 block">
                Existing Variants ({managingVariantsProduct.variants.length})
              </span>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {managingVariantsProduct.variants.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-5 h-5 rounded-full border border-black/40 flex-shrink-0"
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
                      {/* Quick Qty adjuster */}
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
                            const cur = v.unitsInStock ?? 10;
                            handleUpdateVariantStock(v, true);
                          }}
                          className="w-6 h-6 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-bold flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>

                      {/* Stock Toggle */}
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

                      {/* 3D Model Badge */}
                      {v.glbPath ? (
                        <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-800 rounded text-[10px] font-bold">
                          3D Model Attached
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded text-[10px]">
                          No 3D Model
                        </span>
                      )}

                      {/* Delete Variant */}
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

            {/* Add New Variant Form */}
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
                    onChange={(e) =>
                      setNewVariantData({ ...newVariantData, colorName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400">Color Hex Code</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newVariantData.colorHex || '#000000'}
                      onChange={(e) =>
                        setNewVariantData({ ...newVariantData, colorHex: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-700 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      placeholder="#4A3728"
                      value={newVariantData.colorHex || ''}
                      onChange={(e) =>
                        setNewVariantData({ ...newVariantData, colorHex: e.target.value })
                      }
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

              {/* 3D Model Uploader */}
              <div className="space-y-2 p-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
                <label className="text-neutral-300 font-semibold flex items-center justify-between">
                  <span>3D GLB Model (for AR Virtual Try-On)</span>
                  {isUploadingGlb && (
                    <span className="text-brand-400 text-[10px] flex items-center gap-1">
                      <div className="w-2.5 h-2.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                      Uploading 3D Model...
                    </span>
                  )}
                </label>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="/models/glasses.glb"
                    value={newVariantData.glbPath || ''}
                    onChange={(e) =>
                      setNewVariantData({ ...newVariantData, glbPath: e.target.value })
                    }
                    className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-white font-mono text-[11px]"
                  />

                  <label className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Upload .glb</span>
                    <input
                      type="file"
                      accept=".glb"
                      className="hidden"
                      disabled={isUploadingGlb}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleGlbFileUpload(f);
                      }}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Select a binary 3D eyewear model (.glb up to 50MB) to enable live AR fitting.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingVariant || isUploadingGlb}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variant</span>
                </button>
              </div>
            </form>

            <div className="flex justify-end pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setManagingVariantsProduct(null)}
                className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold transition text-xs shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
