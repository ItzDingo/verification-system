export const DASHBOARD_PREFETCH_URLS = {
  stats: '/api/stats',
  unverified: '/api/unverified',
  members: '/api/members',
  leaderboard: '/api/leaderboard',
  serverStats: '/api/server-stats',
  logs: '/api/logs?page=1',
  blacklist: '/api/blacklist',
} as const;

export type DashboardCacheKey = keyof typeof DASHBOARD_PREFETCH_URLS;

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export function peekDashboardCache<T>(key: DashboardCacheKey): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setDashboardCache(key: DashboardCacheKey, data: unknown) {
  cache.set(key, data);
}

export function invalidateDashboardCache(keys?: DashboardCacheKey[]) {
  const toClear = keys ?? (Object.keys(DASHBOARD_PREFETCH_URLS) as DashboardCacheKey[]);
  for (const key of toClear) cache.delete(key);
}

export async function fetchDashboardData<T>(key: DashboardCacheKey, url?: string): Promise<T> {
  const hit = peekDashboardCache<T>(key);
  if (hit !== undefined) return hit;

  const requestUrl = url ?? DASHBOARD_PREFETCH_URLS[key];
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetch(requestUrl, { credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    })
    .then((data) => {
      cache.set(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise as Promise<T>;
}

export function prefetchAllDashboardData() {
  (Object.keys(DASHBOARD_PREFETCH_URLS) as DashboardCacheKey[]).forEach((key) => {
    void fetchDashboardData(key).catch(() => {});
  });
}

export const DASHBOARD_ROUTE_KEYS: Record<string, DashboardCacheKey> = {
  '/dashboard': 'stats',
  '/dashboard/pending': 'unverified',
  '/dashboard/members': 'members',
  '/dashboard/leaderboard': 'leaderboard',
  '/dashboard/stats': 'serverStats',
  '/dashboard/logs': 'logs',
  '/dashboard/blacklist': 'blacklist',
};

export function prefetchDashboardRoute(href: string) {
  const key = DASHBOARD_ROUTE_KEYS[href];
  if (key) void fetchDashboardData(key).catch(() => {});
}

export function updateDashboardCache<T>(key: DashboardCacheKey, data: T) {
  setDashboardCache(key, data);
}
