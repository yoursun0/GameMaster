import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cinzel } from 'next/font/google';
import '@/styles/globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-cinzel',
  adjustFontFallback: false,
  fallback: ['LXGW WenKai TC'],
});

export const metadata: Metadata = {
  title: '異境物語 / Tales Beyond',
  description: 'A shared-screen text RPG with an AI Game Master.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fixtureBanner =
    process.env.NODE_ENV !== 'production' && process.env.AI_MODE === 'fixture';
  return (
    <html lang="zh-Hant" className={cinzel.variable}>
      <body>
        {fixtureBanner ? (
          <p role="status" style={{ margin: 0, padding: '8px 16px', background: '#302d2a', color: '#dab675' }}>
            Fixture Game Master is active. This is not a live model.
          </p>
        ) : null}
        {children}
      </body>
    </html>
  );
}
