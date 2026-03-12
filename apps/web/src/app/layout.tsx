import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { AuthProvider } from '@/components/auth-provider';
import { ToastProvider } from '@/components/toast-provider';
import { getPublicRuntimeScript } from '@/lib/config';

import './globals.css';

const vagRounded = localFont({
  src: [
    { path: './fonts/vag-rounded-thin.ttf', weight: '200', style: 'normal' },
    { path: './fonts/vag-rounded-light.ttf', weight: '400', style: 'normal' },
    { path: './fonts/vag-rounded-bold.ttf', weight: '700', style: 'normal' },
    { path: './fonts/vag-rounded-black.ttf', weight: '900', style: 'normal' },
  ],
  variable: '--font-vag-rounded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'memoo — Operations Platform',
  description: 'Capture browser workflows once. Run them at scale with full governance and audit evidence.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${vagRounded.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: getPublicRuntimeScript() }} />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
