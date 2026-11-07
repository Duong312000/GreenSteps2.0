const PRODUCTION_BACKEND_URL = 'https://greensteps-6swn.onrender.com';
const LOCAL_BACKEND_PORT = 5055;

export function isProductionHost(hostname: string): boolean {
  return hostname === 'greensteps-6swn.onrender.com'
    || hostname.endsWith('.vercel.app')
    || hostname.endsWith('.netlify.app');
}

export function getBackendOrigin(): string {
  const hostname = window.location.hostname;
  if (isProductionHost(hostname)) return PRODUCTION_BACKEND_URL;
  return `${window.location.protocol}//${hostname}:${LOCAL_BACKEND_PORT}`;
}

export function getApiUrl(): string {
  return `${getBackendOrigin()}/api`;
}
