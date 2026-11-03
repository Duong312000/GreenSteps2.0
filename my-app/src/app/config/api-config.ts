export function getApiUrl(): string {
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
    ? 'http://localhost:5055/api'
    : 'https://greensteps-6swn.onrender.com/api';
}
