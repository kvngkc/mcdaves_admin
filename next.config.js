/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL is required. The hardcoded project-ref fallback was removed (Step 3.7).',
  );
}

const supabaseHost = new URL(supabaseUrl).hostname;

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHost,
      },
    ],
  },
};

module.exports = nextConfig;
