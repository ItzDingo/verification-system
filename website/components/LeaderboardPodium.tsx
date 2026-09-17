'use client';

import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';

export interface PodiumEntry {
  staffId: string;
  displayName: string;
  username: string;
  avatar: string;
  accepted: number;
  denied: number;
  total: number;
}

function PodiumColumn({
  entry,
  place,
  maxTotal,
  className = '',
}: {
  entry: PodiumEntry;
  place: 1 | 2 | 3;
  maxTotal: number;
  className?: string;
}) {
  const minHeight = place === 1 ? 88 : place === 2 ? 68 : 56;
  const heightPct = Math.max((entry.total / maxTotal) * 100, minHeight);
  const columnHeight = place === 1 ? 'h-48 sm:h-56' : place === 2 ? 'h-40 sm:h-48' : 'h-36 sm:h-44';

  const barGradient =
    place === 1
      ? 'bg-gradient-to-t from-amber-600 via-amber-500 to-amber-400 dark:from-amber-800 dark:via-amber-600 dark:to-amber-500'
      : place === 2
        ? 'bg-gradient-to-t from-zinc-500 via-zinc-400 to-zinc-300 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-500'
        : 'bg-gradient-to-t from-orange-700 via-orange-600 to-orange-500 dark:from-orange-900 dark:via-orange-700 dark:to-orange-600';

  const medalClass =
    place === 1
      ? 'h-7 w-7 bg-amber-500 text-xs'
      : place === 2
        ? 'h-6 w-6 bg-zinc-500 text-[10px]'
        : 'h-6 w-6 bg-orange-600 text-[10px]';

  const avatarSize = place === 1 ? 'h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]' : 'h-14 w-14 sm:h-[4.25rem] sm:w-[4.25rem]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: place === 1 ? 0.05 : place === 3 ? 0 : 0.1 }}
      className={`flex min-w-0 flex-1 flex-col items-center ${place === 1 ? 'max-w-[11rem] sm:max-w-[12rem]' : 'max-w-[9.5rem]'} ${className}`}
    >
      <div className={`relative flex w-full flex-col justify-end ${columnHeight}`}>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${heightPct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`relative w-full min-h-[4.5rem] rounded-t-2xl shadow-lg ${barGradient}`}
        >
          <div className="absolute left-1/2 top-0 z-10 flex w-full max-w-[9rem] -translate-x-1/2 -translate-y-[58%] flex-col items-center px-1">
            <div className="relative">
              <img
                src={entry.avatar}
                alt=""
                className={`rounded-full border-[3px] border-white object-cover shadow-lg dark:border-zinc-900 ${avatarSize}`}
              />
              <span
                className={`absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full font-bold text-white shadow ${medalClass}`}
              >
                {place}
              </span>
            </div>
            <p className="mt-2 w-full truncate text-center text-sm font-bold text-zinc-900 dark:text-white">
              {entry.displayName}
            </p>
            <p className="w-full truncate text-center text-[11px] text-zinc-500">@{entry.username}</p>
          </div>

          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center text-white drop-shadow-md">
            <span className="text-2xl font-bold leading-none sm:text-3xl">{entry.total}</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest opacity-90">total</span>
          </div>
        </motion.div>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <CheckCircle size={13} className="text-emerald-500" /> {entry.accepted}
        </span>
        <span className="inline-flex items-center gap-1">
          <XCircle size={13} className="text-red-400" /> {entry.denied}
        </span>
      </div>
    </motion.div>
  );
}

export default function LeaderboardPodium({ entries }: { entries: PodiumEntry[] }) {
  const [first, second, third] = entries;
  if (!first) return null;

  const maxTotal = Math.max(first.total, second?.total ?? 0, third?.total ?? 0, 1);

  return (
    <div className="mx-auto mb-10 max-w-3xl rounded-3xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/90 px-2 py-10 dark:border-zinc-800 dark:from-zinc-900/80 dark:to-zinc-950 sm:px-8 sm:py-12">
      <div className="flex items-end justify-center gap-2 sm:gap-6">
        {third ? <PodiumColumn entry={third} place={3} maxTotal={maxTotal} /> : <div className="flex-1" />}
        <PodiumColumn entry={first} place={1} maxTotal={maxTotal} />
        {second ? <PodiumColumn entry={second} place={2} maxTotal={maxTotal} /> : <div className="flex-1" />}
      </div>
    </div>
  );
}
