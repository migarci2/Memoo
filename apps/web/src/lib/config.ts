export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

export function toWsBase(httpBase: string): string {
  if (httpBase.startsWith('https://')) return httpBase.replace('https://', 'wss://');
  if (httpBase.startsWith('http://')) return httpBase.replace('http://', 'ws://');
  return httpBase;
}
