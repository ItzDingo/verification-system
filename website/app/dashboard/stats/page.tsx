'use client';
import { BarChart3, TrendingUp, Clock, Calendar } from 'lucide-react';
import DashboardPageLoader from '@/components/DashboardPageLoader';
import { useDashboardCache } from '@/hooks/useDashboardCache';

interface HourBucket { hour: number; label: string; count: number }
interface DayBucket { day: number; label: string; count: number }

interface ServerStats {
  periodDays: number;
  totals: { verifications: number; requests: number; denied: number };
  peakVerificationHour: HourBucket | null;
  peakRequestHour: HourBucket | null;
  peakActivityHour: HourBucket | null;
  peakVerificationDay: DayBucket | null;
  peakRequestDay: DayBucket | null;
  verificationsByHour: HourBucket[];
  requestsByHour: HourBucket[];
  activityByHour: HourBucket[];
}

function BarChart({ data, color }: { data: HourBucket[]; color: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-40 items-end gap-0.5 sm:gap-1">
      {data.map((d) => (
        <div key={d.hour} className="group relative flex flex-1 flex-col items-center">
          <div
            className={`w-full rounded-t transition-all duration-300 ${color}`}
            style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0)}%`, minHeight: d.count > 0 ? 4 : 0 }}
          />
          <span className="mt-1 hidden text-[8px] text-zinc-400 sm:block">{d.hour % 6 === 0 ? d.label.split(' ')[0] : ''}</span>
          <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">
            {d.label}: {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ServerStatsPage() {
  const { data: stats, loading } = useDashboardCache<ServerStats>('serverStats');

  if (loading) return <DashboardPageLoader label="Loading analytics…" compact />;

  const peakCards = [
    { label: 'Peak Verification Hour', value: stats?.peakVerificationHour, icon: Clock },
    { label: 'Peak Request Hour', value: stats?.peakRequestHour, icon: TrendingUp },
    { label: 'Peak Activity Hour', value: stats?.peakActivityHour, icon: BarChart3 },
    { label: 'Busiest Verification Day', value: stats?.peakVerificationDay, icon: Calendar },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white">
          <BarChart3 size={26} /> Server Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Last {stats?.periodDays ?? 30} days of verification activity</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: 'Verifications', value: stats?.totals.verifications ?? 0 },
          { label: 'Requests', value: stats?.totals.requests ?? 0 },
          { label: 'Denied', value: stats?.totals.denied ?? 0 },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {peakCards.map((card) => {
          const Icon = card.icon;
          const val = card.value as { label?: string; count?: number } | null;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="flex items-center gap-2 text-zinc-500">
                <Icon size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">
                {val?.label ?? '—'} {val?.count !== undefined ? `(${val.count})` : ''}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Verifications by Hour (UTC)</h3>
        <BarChart data={stats?.verificationsByHour ?? []} color="bg-emerald-500/80" />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Verification Requests by Hour (UTC)</h3>
        <BarChart data={stats?.requestsByHour ?? []} color="bg-blue-500/80" />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Combined Activity by Hour</h3>
        <BarChart data={stats?.activityByHour ?? []} color="bg-zinc-900/80 dark:bg-white/80" />
      </div>
    </div>
  );
}
