'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Clock, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import ResultModal, { VerifyResult } from '@/components/ResultModal';
import VerifyActionModal from '@/components/VerifyActionModal';
import DashboardPageLoader from '@/components/DashboardPageLoader';
import { useDashboardCache } from '@/hooks/useDashboardCache';
import { invalidateDashboardCache } from '@/lib/dashboard-cache';

interface User {
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar: string;
  joined_at: string;
}

const ITEMS_PER_PAGE = 10;
const devMock = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';

export default function PendingPage() {
  const { data: users = [], loading, mutate } = useDashboardCache<User[]>('unverified');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reason, setReason] = useState('');
  const [modal, setModal] = useState<{ open: boolean; id: string | null; type: 'accept' | 'deny'; user?: User }>({
    open: false, id: null, type: 'accept',
  });
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = users.filter(u =>
      u.username.toLowerCase().includes(lowerSearch) ||
      (u.global_name && u.global_name.toLowerCase().includes(lowerSearch)) ||
      u.discord_id.includes(lowerSearch)
    );
    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [search, users]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const openModal = (user: User, type: 'accept' | 'deny') => {
    setModal({ open: true, id: user.discord_id, type, user });
    setReason('');
  };

  const handleVerifyComplete = ({ ok, data }: { ok: boolean; data: Record<string, unknown> }) => {
    const targetId = modal.id;
    const modalUser = modal.user;
    const modalType = modal.type;

    setModal({ open: false, id: null, type: 'accept' });

    if (!ok || !targetId) {
      const details: { label: string; value: string }[] = [];
      if (data.reason) details.push({ label: 'Reason', value: String(data.reason) });
      if (data.botOnline === false) {
        details.push({ label: 'Bot Status', value: 'Offline — verification was not registered' });
      }
      if (targetId) details.push({ label: 'User ID', value: targetId });
      setResult({
        success: false,
        title: modalType === 'accept' ? 'Verification Rejected' : 'Action Failed',
        message: (data.error as string) || 'Failed to process',
        details,
      });
      return;
    }

    mutate((prev) => (prev ?? []).filter((u) => u.discord_id !== targetId));
    invalidateDashboardCache(['stats', 'leaderboard', 'logs', 'members']);

    const target = data.target as { displayName?: string; username?: string } | undefined;

    if (modalType === 'accept') {
      setResult({
        success: true,
        title: 'User Verified Successfully',
        message: devMock
          ? 'Mock verification recorded locally.'
          : 'The bot has been notified to assign the verified role and DM the user.',
        details: [
          { label: 'Display Name', value: target?.displayName || modalUser?.global_name || modalUser?.username || '—' },
          { label: 'Username', value: `@${target?.username || modalUser?.username || '—'}` },
          { label: 'Discord ID', value: targetId },
          { label: 'Reason', value: (data.reason as string) || reason || 'Verified by Staff' },
          { label: 'Verified By', value: (data.staff as { tag?: string })?.tag || 'Staff' },
          { label: 'Time', value: new Date((data.timestamp as string) || Date.now()).toLocaleString() },
        ],
      });
    } else {
      setResult({
        success: true,
        title: 'User Denied',
        message: devMock ? 'Mock denial recorded locally.' : 'The denial has been logged.',
        details: [
          { label: 'User', value: modalUser?.global_name || modalUser?.username || targetId },
          { label: 'Reason', value: (data.reason as string) || reason || 'Denied by Staff' },
        ],
      });
    }
  };

  if (loading && users.length === 0) {
    return <DashboardPageLoader label="Loading pending…" compact />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white">
            <Clock size={24} /> Pending Verifications
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {devMock ? 'Local dev mock — accept/deny updates sample data only' : 'Accept pings the bot host and waits for it to wake (~15s on cold start)'}
          </p>
        </div>
        <div className="glass-panel flex w-full items-center gap-2 px-3 py-2 sm:w-64">
          <Search size={16} className="shrink-0 text-zinc-400" />
          <input
            type="text"
            placeholder="Search user..."
            className="w-full border-none bg-transparent text-sm outline-none dark:text-zinc-100"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-5 text-xs text-zinc-400">
        Showing {filteredUsers.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {currentUsers.map((u, i) => (
          <motion.div
            key={u.discord_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="panel-card flex items-center gap-3 p-4"
          >
            <img src={u.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" className="h-11 w-11 rounded-full border border-zinc-200 object-cover dark:border-zinc-700" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-zinc-900 dark:text-white">{u.global_name || u.username}</h3>
              <p className="truncate text-xs text-zinc-500">@{u.username}</p>
              <p className="truncate font-mono text-[10px] text-zinc-400">{u.discord_id}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => openModal(u, 'accept')}
                className="rounded-xl border border-emerald-200 p-2 text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/30"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => openModal(u, 'deny')}
                className="rounded-xl border border-red-200 p-2 text-red-500 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <p className="panel-card p-12 text-center text-sm text-zinc-400">No pending verifications.</p>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-lg border p-1.5 disabled:opacity-30 dark:border-zinc-700"><ChevronLeft size={20} /></button>
          <span className="text-xs text-zinc-400">Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-lg border p-1.5 disabled:opacity-30 dark:border-zinc-700"><ChevronRight size={20} /></button>
        </div>
      )}

      <VerifyActionModal
        open={modal.open}
        type={modal.type}
        user={modal.user}
        reason={reason}
        onReasonChange={setReason}
        onClose={() => setModal({ open: false, id: null, type: 'accept' })}
        onComplete={handleVerifyComplete}
      />

      {result && <ResultModal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}
