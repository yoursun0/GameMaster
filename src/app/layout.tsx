import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '異境物語 / Tales Beyond',
  description: 'A shared-screen text RPG with an AI Game Master.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fixtureBanner =
    process.env.NODE_ENV !== 'production' && process.env.AI_MODE === 'fixture';
  return (
    <html lang="en">
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
