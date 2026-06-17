// Authenticated fetch wrapper for MongoDB/Express API

function resolveApiPath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const baseUrl = typeof window !== 'undefined' ? import.meta.env.VITE_API_BASE_URL : undefined;
  if (baseUrl) {
    return new URL(path, baseUrl).toString();
  }

  return path;
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  // Get JWT token from localStorage (set during login/signup)
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwtToken') : null;
  
  const headers = new Headers(options.headers ?? {});
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(resolveApiPath(path), { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json?.error || text || `API failure: ${response.status}`);
    } catch {
      throw new Error(text || `API failure: ${response.status}`);
    }
  }
  return response.status === 204 ? (undefined as any) : (await response.json());
}
