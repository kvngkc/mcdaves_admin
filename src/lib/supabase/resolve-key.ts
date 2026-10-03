// src/lib/supabase/resolve-key.ts
/**
 * Supabase key resolution with fail-closed semantics (v4 plan step 2.3).
 *
 * The server client must NEVER silently fall back to the anon key when the
 * service-role key is missing: that quietly downgrades the admin API's
 * privileges. And the login route must never use the service-role key as its
 * auth client key.
 */
export interface SupabaseKeyResolution {
  url: string;
  key: string;
  role: 'service' | 'anon';
}

export function resolveSupabaseKey(env: NodeJS.ProcessEnv = process.env): SupabaseKeyResolution {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required.');

  if (service) return { url, key: service, role: 'service' };
  if (env.NODE_ENV === 'production') {
    throw new Error('[FATAL] SUPABASE_SERVICE_ROLE_KEY is required in production. Refusing to start.');
  }
  if (anon) return { url, key: anon, role: 'anon' };
  throw new Error('No Supabase key configured (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY).');
}

/** The login client needs the ANON key — never the service-role key. */
export function resolveLoginAnonKey(env: NodeJS.ProcessEnv = process.env): string {
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) {
    throw new Error('[FATAL] NEXT_PUBLIC_SUPABASE_ANON_KEY is required for the login client.');
  }
  return anon;
}
