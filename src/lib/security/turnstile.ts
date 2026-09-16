interface TurnstileVerificationResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

const PREVIEW_TEST_SECRET = '1x0000000000000000000000000000000AA';

export async function verifyTurnstileToken(token: string | null): Promise<boolean> {
  if (!token) return false;

  const isVercelPreview = process.env.VERCEL_ENV === 'preview';
  const configuredSecret = process.env.TURNSTILE_SECRET_KEY;
  const secretKey = configuredSecret || (isVercelPreview ? PREVIEW_TEST_SECRET : undefined);

  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY is not configured.');
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) return false;
    const data: TurnstileVerificationResponse = await res.json();
    return data.success;
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return false;
  }
}
