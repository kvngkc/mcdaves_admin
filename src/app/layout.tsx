import type { Metadata, Viewport } from 'next';
import './globals.css';
import NextTopLoader from 'nextjs-toploader';
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
    <html lang="en" className="dark h-full w-full">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen w-full antialiased selection:bg-brand-500 selection:text-white">
        <NextTopLoader color="#d97706" height={3} showSpinner={false} />
        <div className="flex h-screen w-full overflow-hidden">
          <Sidebar />
          <main className="flex-1 min-w-0 h-screen overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
