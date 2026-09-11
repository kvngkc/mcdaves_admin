'use client';
import { apiFetch } from '@/lib/api-client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ShoppingBag, CheckCircle2, AlertCircle } from 'lucide-react';
import { Order } from '@/lib/commerce/types';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const url = new URL('/api/orders', window.location.origin);
      if (orderSearch) url.searchParams.set('search', orderSearch);

      const res = await apiFetch(url.toString());
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

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-neutral-950 text-neutral-200">
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

      <header className="sticky top-0 z-20 flex-shrink-0 px-4 sm:px-8 py-5 border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-12 lg:ml-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-brand-500" />
              Confirmed Orders
            </h1>
            <p className="text-xs text-neutral-500 mt-1 max-w-lg">
              View completed and paid orders.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadOrders}
              disabled={isLoadingOrders}
              className="flex items-center justify-center gap-2 p-2.5 sm:px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/60 rounded-xl text-neutral-300 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-sm font-medium">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-8 space-y-6 overflow-y-auto">
        <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-3xl p-4 sm:p-6 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <label htmlFor="orderSearch" className="sr-only">Search Orders</label>
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="orderSearch"
                  type="text"
                  placeholder="Search by Order ID, Reference, Customer..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-950/50 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 shadow-inner"
                />
              </div>
            </div>
          </div>
        </div>      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
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
                  <th className="py-3 px-5">Order ID &amp; Date</th>
                  <th className="py-3 px-5">Customer Ref</th>
                  <th className="py-3 px-5">Purchased Items</th>
                  <th className="py-3 px-5">Total Paid</th>
                  <th className="py-3 px-5">Paystack Ref</th>
                  <th className="py-3 px-5">Prescription</th>
                  <th className="py-3 px-5">Order Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-800/30 transition-colors border-b border-neutral-800/50 group">
                    <td className="py-4 px-5">
                      <span className="font-bold text-white font-mono block text-sm">
                        {order.id.split('-')[0]}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {new Date(order.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>

                    <td className="py-4 px-5 font-mono text-brand-400 font-bold">
                      {order.customerId.split('-')[0]}
                    </td>

                    <td className="py-4 px-5">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-neutral-300 text-sm font-medium">
                          {item.productName} <span className="text-neutral-500 text-xs">({item.variantName}) × {item.quantity}</span>
                        </div>
                      ))}
                    </td>

                    <td className="py-4 px-5 font-black text-white text-sm">
                      ₦{Number(order.totalAmount).toLocaleString()}
                    </td>

                    <td className="py-4 px-5 font-mono text-[11px] text-neutral-400">
                      {order.paymentReference}
                    </td>

                    {/* Prescription column */}
                    <td className="py-4 px-5">
                      {order.prescriptionOption === 'upload' && order.prescriptionFileUrl ? (
                        <a
                          href={order.prescriptionFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition"
                        >
                          📄 View Rx
                        </a>
                      ) : (
                        <span className="text-[11px] text-neutral-500 capitalize">
                          {order.prescriptionOption || '—'}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
      </main>
    </div>
  );
}
