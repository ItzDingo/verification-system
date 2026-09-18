'use client';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, CalendarDays, Flame } from 'lucide-react';
import DashboardPageLoader from '@/components/DashboardPageLoader';
import StatCard from '@/components/StatCard';
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
  verificationsByDay: DayBucket[];
  requestsByDay: DayBucket[];
}

/** Animated vertical bar, styled after the old analytics page. */
function Bar({
  value,
  max,
  label,
  highlight,
  color,
}: {
  value: number;
  max: number;
  label: string;
  highlight?: boolean;
  color?: string;
}) {
  const h = max > 0 ? Math.max(4, Math.round((value / max) * 120)) : 4;
  return (
    <div className="group relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span className="text-[10px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400">{value}</span>
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: h }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`w-full max-w-8 rounded-t-lg ${
          highlight ? color || 'bg-gradient-to-t from-indigo-600 to-sky-400' : 'bg-zinc-200 dark:bg-zinc-700'
        }`}
      />
      <span className={`truncate text-[10px] ${highlight ? 'font-bold text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
        {label}
      </span>
      <div className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">
        {label}: {value}
      </div>
    </div>
  );
}

export default function ServerStatsPage() {
  const { data: stats, loading } = useDashboardCache<ServerStats>('serverStats');

  if (loading) return <DashboardPageLoader label="Loading analytics…" compact />;

  const verificationsByHour = stats?.verificationsByHour ?? [];
  const requestsByHour = stats?.requestsByHour ?? [];
  const activityByHour = stats?.activityByHour ?? [];
  const verificationsByDay = stats?.verificationsByDay ?? [];
  const requestsByDay = stats?.requestsByDay ?? [];

  const maxActivityHour = Math.max(...activityByHour.map((d) => d.count), 1);
  const maxVerDay = Math.max(...verificationsByDay.map((d) => d.count), 1);
  const maxReqDay = Math.max(...requestsByDay.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          <BarChart3 size={26} className="text-zinc-400" /> Server Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Peak hours, peak days and request trends over the last {stats?.periodDays ?? 30} days.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Verifications" value={stats?.totals.verifications ?? 0} icon={TrendingUp} delay={0} accent="success" />
        <StatCard label="Requests" value={stats?.totals.requests ?? 0} icon={Flame} delay={0.05} accent="default" />
        <StatCard label="Denied" value={stats?.totals.denied ?? 0} icon={BarChart3} delay={0.1} accent="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Peak Verification Hour"
          value={stats?.peakVerificationHour ? stats.peakVerificationHour.label : '—'}
          icon={Clock}
          delay={0.15}
          accent="success"
        />
        <StatCard
          label="Peak Request Hour"
          value={stats?.peakRequestHour ? stats.peakRequestHour.label : '—'}
          icon={TrendingUp}
          delay={0.2}
        />
        <StatCard
          label="Peak Activity Hour"
          value={stats?.peakActivityHour ? stats.peakActivityHour.label : '—'}
          icon={Flame}
          delay={0.25}
          accent="warning"
        />
        <StatCard
          label="Busiest Verification Day"
          value={stats?.peakVerificationDay ? stats.peakVerificationDay.label : '—'}
          icon={CalendarDays}
          delay={0.3}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-5"
      >
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <Flame size={15} className="text-amber-500" /> Combined activity by hour
        </h2>
        <p className="mb-4 text-xs text-zinc-500">Verifications + requests together • highlighted bar is the peak hour.</p>
        <div className="relative flex items-end gap-0.5 overflow-x-auto pb-1 sm:gap-1">
          {activityByHour.map((d) => (
            <Bar
              key={d.hour}
              value={d.count}
              max={maxActivityHour}
              label={d.label}
              highlight={d.hour === stats?.peakActivityHour?.hour}
              color="bg-gradient-to-t from-amber-500 to-orange-400"
            />
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="glass-panel p-5"
        >
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <CalendarDays size={15} className="text-sky-500" /> Verifications by weekday
          </h2>
          <p className="mb-4 text-xs text-zinc-500">Accepted verifications per day, last {stats?.periodDays ?? 30} days.</p>
          <div className="flex items-end gap-2">
            {verificationsByDay.map((d) => (
              <Bar
                key={d.day}
                value={d.count}
                max={maxVerDay}
                label={d.label}
                highlight={d.day === stats?.peakVerificationDay?.day}
                color="bg-gradient-to-t from-sky-600 to-sky-400"
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="glass-panel p-5"
        >
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <TrendingUp size={15} className="text-emerald-500" /> Requests by weekday
          </h2>
          <p className="mb-4 text-xs text-zinc-500">New verification requests per day, last {stats?.periodDays ?? 30} days.</p>
          <div className="flex items-end gap-2">
            {requestsByDay.map((d) => (
              <Bar
                key={d.day}
                value={d.count}
                max={maxReqDay}
                label={d.label}
                highlight={d.day === stats?.peakRequestDay?.day}
                color="bg-gradient-to-t from-emerald-600 to-emerald-400"
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="glass-panel p-5"
        >
          <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">Verifications by hour</h2>
          <p className="mb-4 text-xs text-zinc-500">When accepted verifications happen most.</p>
          <div className="flex items-end gap-0.5 overflow-x-auto pb-1 sm:gap-1">
            {verificationsByHour.map((d) => (
              <Bar
                key={d.hour}
                value={d.count}
                max={Math.max(...verificationsByHour.map((x) => x.count), 1)}
                label={d.label}
                highlight={d.hour === stats?.peakVerificationHour?.hour}
                color="bg-gradient-to-t from-emerald-600 to-emerald-400"
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="glass-panel p-5"
        >
          <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">Requests by hour</h2>
          <p className="mb-4 text-xs text-zinc-500">When new verification requests come in most.</p>
          <div className="flex items-end gap-0.5 overflow-x-auto pb-1 sm:gap-1">
            {requestsByHour.map((d) => (
              <Bar
                key={d.hour}
                value={d.count}
                max={Math.max(...requestsByHour.map((x) => x.count), 1)}
                label={d.label}
                highlight={d.hour === stats?.peakRequestHour?.hour}
                color="bg-gradient-to-t from-sky-600 to-sky-400"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
