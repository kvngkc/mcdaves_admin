'use client';

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

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
        <h1 className="text-2xl font-black text-white mb-1">Confirmed Orders</h1>
        <p className="text-neutral-400 text-sm">View completed and paid orders.</p>
      </div>

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
  );
}
