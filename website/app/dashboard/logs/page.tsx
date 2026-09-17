'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, AlertCircle, Filter, Users, ShieldCheck } from 'lucide-react';
import Pagination from '@/components/Pagination';

interface Log {
  id: string;
  target_id: string;
  target_username: string | null;
  staff_id: string;
  staff_tag: string;
  action: string;
  reason: string;
  timestamp: string;
}

interface VerifiedUser {
  discordId: string;
  username: string;
  displayName: string;
  avatar: string;
  verifiedAt: string;
  reason?: string;
}

type Tab = 'activity' | 'verified';

function actionBadgeClass(action: string) {
  if (action === 'accepted') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  if (action === 'denied') return 'bg-red-500/15 text-red-600 dark:text-red-400';
  if (action === 'blacklisted') return 'bg-zinc-900/10 text-zinc-700 dark:bg-white/10 dark:text-zinc-300';
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
}

export default function LogsPage() {
  const [tab, setTab] = useState<Tab>('activity');
  const [logs, setLogs] = useState<Log[]>([]);
  const [verifiedUsers, setVerifiedUsers] = useState<VerifiedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');
  const [staffOptions, setStaffOptions] = useState<{ id: string; tag: string }[]>([]);
  const [search, setSearch] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (staffFilter) params.set('staffId', staffFilter);

    const res = await fetch(`/api/logs?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load logs');
    } else {
      setLogs(data.logs);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setStaffOptions(data.staffOptions || []);
    }
    setLoading(false);
  }, [page, actionFilter, staffFilter]);

  const loadVerified = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('search', search);

    const res = await fetch(`/api/verified-users?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load verified users');
    } else {
      setVerifiedUsers(data.users);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    setPage(1);
  }, [tab, actionFilter, staffFilter, search]);

  useEffect(() => {
    if (tab === 'activity') loadLogs();
    else loadVerified();
  }, [tab, loadLogs, loadVerified]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white">
          <FileText size={24} /> Logs & Records
        </h1>
        <div className="flex rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
              tab === 'activity' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500'
            }`}
          >
            <Filter size={14} /> Activity
          </button>
          <button
            type="button"
            onClick={() => setTab('verified')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
              tab === 'verified' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500'
            }`}
          >
            <ShieldCheck size={14} /> Verified Users
          </button>
        </div>
      </div>

      {tab === 'activity' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 flex flex-wrap gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All actions</option>
            <option value="accepted">Accepted</option>
            <option value="denied">Denied</option>
            <option value="blacklisted">Blacklisted</option>
            <option value="unblacklisted">Unblacklisted</option>
          </select>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">All staff</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.tag}</option>
            ))}
          </select>
        </motion.div>
      )}

      {tab === 'verified' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
          <input
            type="text"
            placeholder="Search verified users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </motion.div>
      )}

      {loading && <div className="text-sm text-zinc-400 animate-pulse">Loading...</div>}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {!loading && !error && tab === 'activity' && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
                <tr>
                  {['Time', 'Staff', 'Action', 'Target', 'Reason'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/80">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-sm text-zinc-400">No logs found.</td></tr>
                ) : (
                  logs.map((l, i) => (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium">{l.staff_tag}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionBadgeClass(l.action)}`}>
                          {l.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{l.target_username || l.target_id}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{l.reason}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'verified' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {verifiedUsers.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-zinc-200 p-12 text-center text-sm text-zinc-400 dark:border-zinc-800">No verified users yet.</p>
          ) : (
            verifiedUsers.map((u, i) => (
              <motion.div
                key={u.discordId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <img src={u.avatar} alt="" className="h-11 w-11 rounded-full border border-zinc-200 object-cover dark:border-zinc-700" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-zinc-900 dark:text-white">{u.displayName}</p>
                  <p className="truncate text-xs text-zinc-500">@{u.username}</p>
                  <p className="text-[10px] text-zinc-400">{new Date(u.verifiedAt).toLocaleDateString()}</p>
                  {u.reason && <p className="mt-1 truncate text-xs text-zinc-500">{u.reason}</p>}
                </div>
                <Users size={16} className="shrink-0 text-emerald-500" />
              </motion.div>
            ))
          )}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}
