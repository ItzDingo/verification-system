export function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  return [];
}

export async function fetchJson<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 15000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = (await res.json()) as T;
    if (!res.ok) {
      throw new Error(
        typeof data === 'object' && data && 'error' in data
          ? String((data as { error: string }).error)
          : `Request failed (${res.status})`
      );
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJsonArray<T>(url: string, timeoutMs = 15000): Promise<T[]> {
  try {
    const data = await fetchJson<unknown>(url, { timeoutMs });
    return asArray<T>(data);
  } catch {
    return [];
  }
}
