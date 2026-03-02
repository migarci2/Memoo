/** Client-side (browser) base URL */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

/** Server-side (container-to-container) base URL — falls back to the public one */
export const API_BASE_URL_SERVER =
  process.env.API_BASE_URL_INTERNAL ?? API_BASE_URL;

export function toWsBase(httpBase: string): string {
  if (httpBase.startsWith('https://')) return httpBase.replace('https://', 'wss://');
  if (httpBase.startsWith('http://')) return httpBase.replace('http://', 'ws://');
  return httpBase;
}
