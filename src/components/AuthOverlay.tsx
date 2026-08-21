'use client';
import { apiFetch } from '@/lib/api-client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface AuthOverlayProps {
  children: React.ReactNode;
}

export default function AuthOverlay({ children }: AuthOverlayProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Check auth session
  useEffect(() => {
    async function verifySession() {
      try {
        const res = await apiFetch('/api/auth/session');
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
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: passcode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setPasscode('');
        setAuthError(null);
      } else {
        setAuthError(data.error || 'Incorrect administrator passkey. Access denied.');
      }
    } catch {
      setAuthError('Unable to connect to authentication server. Please retry.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-neutral-400 animate-spin mb-4" />
        <p className="text-neutral-400 font-mono text-sm">Verifying secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 selection:bg-brand-500 selection:text-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 mb-6 shadow-2xl">
              <ShieldCheck className="w-8 h-8 text-neutral-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mb-2">
              McDaves Admin Console
            </h1>
            <p className="text-neutral-400 text-sm">
              Please enter your passkey to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="space-y-4">
              <div>
                <label htmlFor="passcode" className="sr-only">Passkey</label>
                <input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setAuthError(null);
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all text-center tracking-[0.2em] font-mono text-lg"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  autoFocus
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-center">
                  <p className="text-red-400 text-sm">{authError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn || !passcode.trim()}
                className="w-full bg-white text-neutral-950 font-bold py-3.5 px-4 rounded-xl hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Access Dashboard'
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-neutral-600 font-mono">
              IP Logged. Unauthorized access is prohibited.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
