'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import DashboardPageLoader from '@/components/DashboardPageLoader';
import { useDashboardCache } from '@/hooks/useDashboardCache';

interface Member {
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  roles: string[];
  joined_at: string;
  is_verified: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function MembersPage() {
  const { data: members = [], loading } = useDashboardCache<Member[]>('members');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const loadError =
    members.length === 0 && !loading
      ? 'No members loaded. Check Discord bot token and GUILD_ID in .env.local, or use dev mode without Discord.'
      : '';

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return members.filter(
      (m) =>
        m.username?.toLowerCase().includes(lower) ||
        (m.global_name && m.global_name.toLowerCase().includes(lower)) ||
        m.discord_id.includes(lower)
    );
  }, [search, members]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentMembers = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (loading) return <DashboardPageLoader label="Loading members…" compact />;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-white">
          <Users className="text-zinc-400 dark:text-zinc-500" size={22} strokeWidth={2} /> Server Members
        </h1>
        <div className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 sm:w-60">
          <Search size={16} className="shrink-0 text-zinc-400 dark:text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search user..." 
            className="w-full border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loadError && members.length === 0 && (
        <p className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          {loadError}
        </p>
      )}

      <div className="mb-5 text-xs text-zinc-400 dark:text-zinc-500">
        {filtered.length > 0
          ? `Showing ${startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} members`
          : 'No members to display'}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {currentMembers.map((m) => (
          <div
            key={m.discord_id}
            className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-4 transition-all duration-150 hover:border-zinc-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-600"
          >
            <img 
              src={m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} 
              alt={m.username}
              className="h-10 w-10 shrink-0 rounded-full border border-zinc-100 dark:border-zinc-700" 
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{m.global_name || m.username}</h3>
              <p className="truncate text-xs text-zinc-400 dark:text-zinc-500">@{m.username}</p>
            </div>
            <div className="shrink-0">
               {m.is_verified ? (
                 <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-white dark:text-zinc-900">
                   Verified
                 </span>
               ) : (
                 <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-400">
                   Unverified
                 </span>
               )}
            </div>
          </div>
        ))}
      </div>

       {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition-all duration-150 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Page {currentPage} of {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition-all duration-150 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
