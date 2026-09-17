'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Ban, Trash2, UserX } from 'lucide-react';
import DashboardPageLoader from '@/components/DashboardPageLoader';
import { useDashboardCache } from '@/hooks/useDashboardCache';
import { invalidateDashboardCache } from '@/lib/dashboard-cache';

interface BlacklistEntry {
  user_id: string;
  reason: string;
  blacklisted_by: string;
  displayName: string;
  username: string;
  avatar: string;
}

export default function BlacklistPage() {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [msg, setMsg] = useState('');
  const { data: entries = [], loading: loadingList, mutate } = useDashboardCache<BlacklistEntry[]>('blacklist');

  const handleSubmit = async () => {
    if (!userId) return;
    setMsg('Processing...');

    const res = await fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, reason }),
    });

    const data = await res.json();
    setMsg(res.ok ? '✅ Success!' : `❌ Error: ${data.error}`);
    if (res.ok) {
      setUserId('');
      setReason('');
      invalidateDashboardCache(['blacklist', 'logs', 'stats']);
      mutate([]);
      fetch('/api/blacklist')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) mutate(data);
        })
        .catch(() => {});
    }
  };

  const quickRemove = async (id: string) => {
    setMsg('Processing...');
    const res = await fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, action: 'remove', reason: 'Removed from list' }),
    });
    const data = await res.json();
    setMsg(res.ok ? '✅ Removed from blacklist' : `❌ ${data.error}`);
    if (res.ok) {
      invalidateDashboardCache(['blacklist', 'logs', 'stats']);
      mutate((prev) => (prev ?? []).filter((e) => e.user_id !== id));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white">
          <AlertTriangle size={26} /> Blacklist Management
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Owner-only · Block users from being verified</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40"
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <Ban size={16} /> Add or Remove
          </h2>
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Discord User ID</label>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="123456789012345678"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Reason</label>
            <textarea
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              rows={2}
              placeholder="Why are they being blacklisted?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="mb-6 flex gap-2">
            {(['add', 'remove'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  action === a
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'border border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'
                }`}
              >
                {a === 'add' ? 'Add to Blacklist' : 'Remove'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
          >
            Submit Action
          </button>
          {msg && (
            <p className={`mt-3 text-center text-sm ${msg.startsWith('✅') ? 'text-emerald-600' : msg.startsWith('❌') ? 'text-red-500' : 'text-zinc-400'}`}>
              {msg}
            </p>
          )}
        </motion.div>

        <div>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <UserX size={16} /> Active Blacklist ({entries.length})
          </h2>
          {loadingList && entries.length === 0 ? (
            <DashboardPageLoader compact />
          ) : entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700">No active blacklisted users.</p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {entries.map((entry, i) => (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <img src={entry.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-zinc-900 dark:text-white">{entry.displayName}</p>
                      <p className="truncate text-xs text-zinc-500">@{entry.username}</p>
                      <p className="truncate text-xs text-red-500/80">{entry.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => quickRemove(entry.user_id)}
                      className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                      title="Remove from blacklist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
