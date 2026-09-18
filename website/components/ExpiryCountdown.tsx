'use client';

import { useEffect, useState } from 'react';
import { Infinity as InfinityIcon, Clock } from 'lucide-react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired — awaiting reset';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

/** Live-ticking "time remaining" badge for a timed verification, or a permanent badge if verifiedUntil is null. */
export default function ExpiryCountdown({ verifiedUntil }: { verifiedUntil: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!verifiedUntil) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [verifiedUntil]);

  if (!verifiedUntil) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        <InfinityIcon size={10} /> Permanent
      </span>
    );
  }

  const remainingMs = new Date(verifiedUntil).getTime() - now;
  const expired = remainingMs <= 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        expired
          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
      }`}
    >
      <Clock size={10} /> {formatRemaining(remainingMs)}
    </span>
  );
}
