'use client';

import { useEffect } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: 'sans-serif', background: '#F5F2EE', color: '#1A1916' }}>
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <span style={{ marginBottom: '1rem', color: '#8B8680', display: 'inline-flex' }}>
            <WarningCircle size={52} weight="duotone" />
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: '0.75rem', color: '#8B8680', maxWidth: '36ch' }}>
            {error.message ?? 'A critical error occurred.'}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.625rem 1.5rem',
              borderRadius: '9999px',
              background: '#3D5F73',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
