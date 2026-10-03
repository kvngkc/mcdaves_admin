import { describe, it, expect } from 'vitest';
import { resolveSupabaseKey, resolveLoginAnonKey } from '@/lib/supabase/resolve-key';

// Step 2.3 — Remove the service-role auth fallback.
// Verify: boot with the anon key unset; the app must refuse to start (or the
// login route must error) instead of authenticating with the service key.

const base = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' };

describe('2.3 — service-role is never used as the login/auth client key', () => {
  it('the login client hard-fails when the anon key is unset', () => {
    expect(() => resolveLoginAnonKey({ ...base, SUPABASE_SERVICE_ROLE_KEY: 'service-key' } as any))
      .toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY is required/);
  });

  it('the login client uses the anon key when present', () => {
    expect(resolveLoginAnonKey({ ...base, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' } as any)).toBe('anon-key');
  });

  it('production refuses to start when the service-role key is missing (no anon downgrade)', () => {
    expect(() => resolveSupabaseKey({ ...base, NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' } as any))
      .toThrowError(/SUPABASE_SERVICE_ROLE_KEY is required in production/);
  });

  it('production uses the service-role key when it is configured', () => {
    expect(resolveSupabaseKey({ ...base, NODE_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'service-key' } as any))
      .toEqual({ url: base.NEXT_PUBLIC_SUPABASE_URL, key: 'service-key', role: 'service' });
  });

  it('non-production may degrade to the anon key, but only when it exists', () => {
    expect(resolveSupabaseKey({ ...base, NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' } as any).role).toBe('anon');
    expect(() => resolveSupabaseKey({ ...base, NODE_ENV: 'development' } as any)).toThrowError(/No Supabase key configured/);
  });
});
