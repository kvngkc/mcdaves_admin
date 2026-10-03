// src/lib/security/login-lockout.ts
import { Redis } from '@upstash/redis';

// Step 5.6: per-account login lockout. Independent of the global IP limiter so
// credential-stuffing spread across many IPs still trips a per-email control.
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // counting window
const LOCKOUT_SECONDS = 15 * 60; // lockout duration once the threshold is hit

let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  console.warn('Failed to initialize Upstash Redis for login lockout:', error);
}

// In-memory fallback so the lockout still works when Redis is not configured.
const memory = new Map<string, { count: number; first: number; lockedUntil: number }>();

function key(email: string): string {
  return `login-lockout:${email.trim().toLowerCase()}`;
}

export interface LockoutState {
  locked: boolean;
  retryAfterSeconds: number;
}

export async function checkLoginLockout(email: string): Promise<LockoutState> {
  const k = key(email);
  if (redis) {
    const lockedUntil = await redis.get<number>(`${k}:locked`);
    if (lockedUntil && lockedUntil > Date.now()) {
      return { locked: true, retryAfterSeconds: Math.ceil((lockedUntil - Date.now()) / 1000) };
    }
    return { locked: false, retryAfterSeconds: 0 };
  }
  const rec = memory.get(k);
  if (rec && rec.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSeconds: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

export async function recordLoginFailure(
  email: string,
): Promise<{ locked: boolean; attempts: number }> {
  const k = key(email);
  if (redis) {
    const attempts = await redis.incr(`${k}:count`);
    if (attempts === 1) await redis.expire(`${k}:count`, WINDOW_SECONDS);
    if (attempts >= MAX_ATTEMPTS) {
      await redis.set(`${k}:locked`, Date.now() + LOCKOUT_SECONDS * 1000, { ex: LOCKOUT_SECONDS });
      await alertRepeatedFailures(email, attempts);
      return { locked: true, attempts };
    }
    return { locked: false, attempts };
  }
  const now = Date.now();
  const rec = memory.get(k) ?? { count: 0, first: now, lockedUntil: 0 };
  if (now - rec.first > WINDOW_SECONDS * 1000) {
    rec.count = 0;
    rec.first = now;
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_SECONDS * 1000;
    memory.set(k, rec);
    await alertRepeatedFailures(email, rec.count);
    return { locked: true, attempts: rec.count };
  }
  memory.set(k, rec);
  return { locked: false, attempts: rec.count };
}

export async function clearLoginFailures(email: string): Promise<void> {
  const k = key(email);
  if (redis) {
    await redis.del(`${k}:count`, `${k}:locked`);
    return;
  }
  memory.delete(k);
}

async function alertRepeatedFailures(email: string, attempts: number): Promise<void> {
  // Alerting hook: emit a structured warning and, when configured, POST it to
  // the alerting sink (Slack webhook / log drain) via LOGIN_ALERT_WEBHOOK_URL.
  const payload = { event: 'login_lockout', email, attempts, at: new Date().toISOString() };
  console.warn('[security] repeated login failures — account locked', JSON.stringify(payload));
  const webhook = process.env.LOGIN_ALERT_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn('[security] failed to deliver login alert', error);
    }
  }
}
