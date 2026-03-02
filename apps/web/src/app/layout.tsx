import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import './globals.css';

const appSans = Manrope({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const appMono = IBM_Plex_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['500'],
});

export const metadata: Metadata = {
  title: 'Memoo Platform',
  description: 'Internal operations platform for executable playbooks',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${appSans.variable} ${appMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
