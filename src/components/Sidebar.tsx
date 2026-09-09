'use client';
import { apiFetch } from '@/lib/api-client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  Package,
  Users,
  LogOut,
  Sparkles,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  React.useEffect(() => {
    async function fetchUser() {
      try {
        const response = await apiFetch('/api/auth/me');
        const res = await response.json();
        if (res.user?.role) {
          setUserRole(res.user.role);
        }
      } catch (err) {
        console.error('Failed to fetch user role', err);
      }
    }
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch {
      // Ignore
    }
  };

  const navItems = [
    { name: 'Intents', href: '/intents', icon: Users, roles: ['admin', 'manager', 'staff'] },
    { name: 'Orders', href: '/orders', icon: Package, roles: ['admin', 'manager', 'staff'] },
    { name: 'Products', href: '/products', icon: ShoppingBag, roles: ['admin', 'manager'] },
    { name: 'Team', href: '/users', icon: Users, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!userRole) return false;
    return item.roles.includes(userRole);
  });

  return (
    <>
      {/* Mobile Hamburger Button */}
      <div className="lg:hidden fixed top-0 left-0 z-50 p-4">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white shadow-lg active:scale-95 transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 border-r border-neutral-800/60 bg-neutral-950/95 backdrop-blur-xl flex flex-col h-screen transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:sticky lg:top-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 active:scale-95 transition-transform" onClick={() => setIsOpen(false)}>
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black tracking-tight text-white leading-tight">McDaves Admin</span>
              {userRole && <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">{userRole}</span>}
            </div>
          </Link>
          <button 
            className="lg:hidden p-2 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-900"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto mt-4">
          {filteredNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm active:scale-95 ${
                  isActive
                    ? 'bg-neutral-900/80 text-white shadow-inner border border-white/5'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50 border border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-brand-500' : 'text-neutral-500 group-hover:text-neutral-300'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800/60">
          <button
            onClick={handleLogout}
            className="group flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-neutral-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5 text-neutral-500 group-hover:text-red-400/70" />
            Secure Logout
          </button>
        </div>
      </aside>
    </>
  );
}
