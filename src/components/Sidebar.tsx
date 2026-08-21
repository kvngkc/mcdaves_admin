'use client';
import { apiFetch } from '@/lib/api-client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  Package,
  Users,
  LogOut,
  Sparkles,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch {
      // Ignore
    }
  };

  const navItems = [
    { name: 'Intents', href: '/intents', icon: Users },
    { name: 'Orders', href: '/orders', icon: Package },
    { name: 'Products', href: '/products', icon: ShoppingBag },
  ];

  return (
    <aside className="w-64 border-r border-neutral-800 bg-neutral-950 flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-black tracking-tight text-white">McDaves Admin</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-brand-500' : 'text-neutral-500'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-neutral-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-900/50 rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5 text-neutral-500" />
          Secure Logout
        </button>
      </div>
    </aside>
  );
}
