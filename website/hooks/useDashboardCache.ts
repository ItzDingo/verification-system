'use client';

import { useEffect, useState } from 'react';
import {
  DashboardCacheKey,
  DASHBOARD_PREFETCH_URLS,
  fetchDashboardData,
  peekDashboardCache,
  setDashboardCache,
} from '@/lib/dashboard-cache';

export function useDashboardCache<T>(key: DashboardCacheKey, url?: string) {
  const cached = peekDashboardCache<T>(key);
  const [data, setData] = useState<T | undefined>(cached);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const requestUrl = url ?? DASHBOARD_PREFETCH_URLS[key];
    const hit = peekDashboardCache<T>(key);

    if (hit !== undefined) {
      setData(hit);
      setLoading(false);
    }

    fetchDashboardData<T>(key, requestUrl)
      .then((next) => {
        if (!cancelled) {
          setData((prev) => {
            if (prev !== undefined && JSON.stringify(prev) === JSON.stringify(next)) {
              return prev;
            }
            return next;
          });
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, url]);

  const mutate = (next: T | ((prev: T | undefined) => T)) => {
    setData((prev) => {
      const value = typeof next === 'function' ? (next as (p: T | undefined) => T)(prev) : next;
      setDashboardCache(key, value);
      return value;
    });
  };

  return { data, loading: loading && data === undefined, error, mutate };
}
