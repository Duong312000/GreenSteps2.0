const PRODUCTION_BACKEND_URL = 'https://greensteps-backend.vercel.app';
const LOCAL_BACKEND_PORT = 5055;

export function isProductionHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return !['localhost', '127.0.0.1', '::1'].includes(host);
}

export function getBackendOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_BACKEND_URL;
  const hostname = window.location.hostname;
  if (isProductionHost(hostname)) return PRODUCTION_BACKEND_URL;
  return `${window.location.protocol}//${hostname}:${LOCAL_BACKEND_PORT}`;
}

export function getApiUrl(): string {
  return `${getBackendOrigin()}/api`;
}
