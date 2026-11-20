// Central API, Media, Overlay & WebSocket resolver for Frontend (Vercel) <-> Backend (Railway)

const SESSION_TOKEN_KEY = 'mlg_session_token';

export const API_BASE_URL = String(import.meta.env.VITE_API_URL || '')
  .trim()
  .replace(/\/+$/, '');

export const WS_BASE_URL = String(import.meta.env.VITE_WS_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token?: string | null): void {
  if (!token) return;
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {}
}

export function clearSessionToken(): void {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

export function getApiUrl(path: string): string {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

export function getMediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return normalized;
  return `${API_BASE_URL}${normalized}`;
}

export function getOverlayUrl(gameId: string, userId: number | string): string {
  const base = API_BASE_URL || window.location.origin;
  return `${base}/overlay/${encodeURIComponent(gameId)}/${encodeURIComponent(String(userId))}`;
}

export function getLiveWsUrl(userId: number | string): string {
  let base = '';
  if (WS_BASE_URL) {
    base = WS_BASE_URL.endsWith('/ws/live') ? WS_BASE_URL : `${WS_BASE_URL}/ws/live`;
  } else if (API_BASE_URL) {
    const wsBase = API_BASE_URL.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    base = `${wsBase}/ws/live`;
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    base = `${proto}//${window.location.host}/ws/live`;
  }
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}userId=${encodeURIComponent(String(userId))}`;
}

let interceptorInstalled = false;

/**
 * Transparently rewrites relative `/api/...` calls to the configured Railway backend
 * (`VITE_API_URL`) and guarantees cross-origin cookies (`credentials: 'include'`) +
 * Bearer session fallback for browsers with strict third-party cookie blocking.
 */
export function installApiFetchInterceptor(): void {
  if (interceptorInstalled || typeof window === 'undefined' || !window.fetch) return;
  interceptorInstalled = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isRelativeApi = rawUrl.startsWith('/api/');

    if (!isRelativeApi) {
      return nativeFetch(input, init);
    }

    const targetUrl = getApiUrl(rawUrl);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const token = getSessionToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const nextInit: RequestInit = {
      ...init,
      credentials: 'include',
      headers,
    };

    return nativeFetch(targetUrl, nextInit);
  };
}
