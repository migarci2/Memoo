export interface PublicRuntimeConfig {
  apiBaseUrl: string;
  apiPublicBaseUrl: string;
  sandboxNovncUrl: string;
  geminiApiKey: string;
  geminiLiveModel: string;
}

declare global {
  interface Window {
    __MEMOO_RUNTIME_CONFIG__?: PublicRuntimeConfig;
  }
}

const DEFAULT_API_BASE_URL = '/api/proxy';
const DEFAULT_API_PUBLIC_BASE_URL = 'http://localhost:8000/api';
const DEFAULT_SANDBOX_NOVNC_URL =
  'http://localhost:6080/vnc.html?autoconnect=true&resize=scale&reconnect=true&show_dot=false';
const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

function normalizeSandboxNovncUrl(rawUrl: string): string {
  try {
    const base =
      typeof window !== 'undefined' && window.location?.href
        ? window.location.href
        : 'http://localhost/';
    const url = new URL(rawUrl, base);
    url.searchParams.set('autoconnect', 'true');
    url.searchParams.set('resize', 'scale');
    url.searchParams.set('reconnect', 'true');
    url.searchParams.set('show_dot', 'false');
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function browserRuntimeConfig(): Partial<PublicRuntimeConfig> | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__MEMOO_RUNTIME_CONFIG__;
}

export function getPublicRuntimeConfig(): PublicRuntimeConfig {
  const browserConfig = browserRuntimeConfig();

  return {
    apiBaseUrl:
      browserConfig?.apiBaseUrl
      ?? process.env.NEXT_PUBLIC_API_BASE_URL
      ?? DEFAULT_API_BASE_URL,
    apiPublicBaseUrl:
      browserConfig?.apiPublicBaseUrl
      ?? process.env.NEXT_PUBLIC_API_PUBLIC_BASE_URL
      ?? DEFAULT_API_PUBLIC_BASE_URL,
    sandboxNovncUrl:
      browserConfig?.sandboxNovncUrl
      ?? process.env.NEXT_PUBLIC_SANDBOX_NOVNC_URL
      ?? DEFAULT_SANDBOX_NOVNC_URL,
    geminiApiKey:
      browserConfig?.geminiApiKey
      ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY
      ?? '',
    geminiLiveModel:
      browserConfig?.geminiLiveModel
      ?? process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL
      ?? DEFAULT_GEMINI_LIVE_MODEL,
  };
}

export function getPublicRuntimeScript(): string {
  const payload = JSON.stringify(getPublicRuntimeConfig()).replace(/</g, '\\u003c');
  return `window.__MEMOO_RUNTIME_CONFIG__ = ${payload};`;
}

export function getApiBaseUrl(): string {
  return getPublicRuntimeConfig().apiBaseUrl;
}

export function getApiBaseUrlServer(): string {
  return process.env.API_BASE_URL_INTERNAL ?? getPublicRuntimeConfig().apiPublicBaseUrl;
}

export function getSandboxNovncUrl(): string {
  return normalizeSandboxNovncUrl(getPublicRuntimeConfig().sandboxNovncUrl);
}

export function getApiPublicBaseUrl(): string {
  return getPublicRuntimeConfig().apiPublicBaseUrl;
}

export function getGeminiApiKey(): string {
  return getPublicRuntimeConfig().geminiApiKey;
}

export function getGeminiLiveModel(): string {
  return getPublicRuntimeConfig().geminiLiveModel;
}

export function toWsBase(httpBase: string): string {
  if (httpBase.startsWith('https://')) return httpBase.replace('https://', 'wss://');
  if (httpBase.startsWith('http://')) return httpBase.replace('http://', 'ws://');
  return httpBase;
}
