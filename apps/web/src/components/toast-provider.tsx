'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
};

type ToastContextValue = {
  toast: (message: string, type?: Toast['type']) => void;
};

import { createContext, useContext, useCallback } from 'react';

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (message: string, type: Toast['type'] = 'info') => {
      const id = Math.random().toString(36).slice(2);
      setToasts(prev => [...prev.slice(-4), { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), 4000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 ? (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2"
          style={{ maxWidth: 'min(360px, calc(100vw - 2.5rem))' }}
        >
          {toasts.map(t => (
            <div
              key={t.id}
              role="status"
              className={[
                'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur',
                t.type === 'success'
                  ? 'border-[var(--app-sage)]/40 bg-[var(--app-surface)]/95 text-[#335443]'
                  : t.type === 'error'
                    ? 'border-red-300/50 bg-[var(--app-surface)]/95 text-red-700'
                    : 'border-[var(--app-line)] bg-[var(--app-surface)]/95 text-[var(--app-text)]',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                  t.type === 'success'
                    ? 'bg-[var(--app-sage)]'
                    : t.type === 'error'
                      ? 'bg-red-500'
                      : 'bg-[var(--app-blue)]',
                ].join(' ')}
              />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-[var(--app-muted)] transition-opacity hover:opacity-70"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
