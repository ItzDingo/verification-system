'use client';

import { Trophy, CheckCircle, XCircle } from 'lucide-react';
import LeaderboardPodium, { PodiumEntry } from '@/components/LeaderboardPodium';
import DashboardPageLoader from '@/components/DashboardPageLoader';
import { useDashboardCache } from '@/hooks/useDashboardCache';

export default function LeaderboardPage() {
  const { data: entries, loading } = useDashboardCache<PodiumEntry[]>('leaderboard');

  if (loading) return <DashboardPageLoader label="Loading leaderboard…" compact />;

  const list = entries ?? [];
  const rest = list.slice(3);

  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white">
        <Trophy className="text-amber-500" size={26} /> Staff Leaderboard
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">Top staff by verification activity</p>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40">
          No staff activity recorded yet.
        </p>
      ) : (
        <>
          <LeaderboardPodium entries={list} />

          {rest.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Everyone else</h2>
              <div className="space-y-2">
                {rest.map((entry, index) => (
                  <div
                    key={entry.staffId}
                    className="glass-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {index + 4}
                      </span>
                      <img src={entry.avatar} alt="" className="h-10 w-10 rounded-full border border-zinc-200 object-cover dark:border-zinc-700" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-zinc-900 dark:text-white">{entry.displayName}</p>
                        <p className="truncate text-xs text-zinc-500">@{entry.username}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm sm:justify-end">
                      <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                        <CheckCircle size={14} className="text-emerald-500" /> {entry.accepted}
                      </span>
                      <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                        <XCircle size={14} className="text-red-400" /> {entry.denied}
                      </span>
                      <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-bold text-white dark:bg-white dark:text-zinc-900">
                        {entry.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
