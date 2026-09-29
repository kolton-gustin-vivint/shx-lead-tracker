import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { SessionProvider } from '@FO-Enablement-Vivint/magistrate/next';

export const metadata: Metadata = {
  title: 'SHX Leads Tracker',
  description: 'Lead pipeline, activities, self-gen time and compensation for the SHX team.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
