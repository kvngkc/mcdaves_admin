import type { Metadata, Viewport } from 'next';
import './globals.css';
import NextTopLoader from 'nextjs-toploader';
import AuthOverlay from '@/components/AuthOverlay';
import Sidebar from '@/components/Sidebar';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'McDaves Admin Console | iamadmin.mcdaves.com.ng',
  description: 'Private administration portal for McDaves Eyewear & Optical Commerce',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen antialiased selection:bg-brand-500 selection:text-white flex overflow-x-hidden">
        <NextTopLoader color="#d97706" height={3} showSpinner={false} />
        <AuthOverlay>
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-y-auto">
            {children}
          </main>
        </AuthOverlay>
      </body>
    </html>
  );
}
