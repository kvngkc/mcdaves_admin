'use client';
import { apiFetch } from '@/lib/api-client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Copy, Check, CreditCard, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { OrderIntent, OrderIntentStatus } from '@/lib/commerce/types';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function IntentsPage() {
  const [intents, setIntents] = useState<OrderIntent[]>([]);
  const [intentSearch, setIntentSearch] = useState('');
  const [intentStatusFilter, setIntentStatusFilter] = useState('ALL');
  const [isLoadingIntents, setIsLoadingIntents] = useState(false);
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadIntents = useCallback(async () => {
    setIsLoadingIntents(true);
    try {
      const url = new URL('/api/order-intents', window.location.origin);
      if (intentStatusFilter !== 'ALL') url.searchParams.set('status', intentStatusFilter);
      if (intentSearch) url.searchParams.set('search', intentSearch);

      const res = await apiFetch(url.toString());
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

  useEffect(() => {
    loadIntents();
  }, [loadIntents]);

  const handleUpdateIntentStatus = async (id: string, newStatus: OrderIntentStatus) => {
    try {
      const res = await apiFetch(`/api/order-intents/${id}`, {
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

  const handleGeneratePaymentLink = async (intentId: string) => {
    setGeneratingLinkFor(intentId);
    try {
      const res = await apiFetch(`/api/order-intents/${intentId}`, {
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

  return (
    <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
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

      <div>
        <h1 className="text-2xl font-black text-white mb-1">Order Intents</h1>
        <p className="text-neutral-400 text-sm">Track and manage customer leads and abandoned carts.</p>
      </div>

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
  );
}
