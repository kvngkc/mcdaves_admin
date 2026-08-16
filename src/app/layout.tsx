import type { Metadata } from 'next';
import './globals.css';

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
      <body className="bg-neutral-950 text-neutral-100 min-h-screen antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
