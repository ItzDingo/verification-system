'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users, Clock, ShieldCheck, Ban, Activity, CheckCircle, XCircle, Wifi, WifiOff, Trophy, BarChart3,
} from 'lucide-react';
import StatCard from '@/components/StatCard';
import DashboardPageLoader from '@/components/DashboardPageLoader';
import { useDashboardCache } from '@/hooks/useDashboardCache';

interface Stats {
  verified: number;
  pending: number;
  blacklisted: number;
  totalActions: number;
  accepted: number;
  denied: number;
  todayActions: number;
  botOnline: boolean;
  botLatencyMs?: number;
}

export default function DashboardPage() {
  const { data: stats, loading } = useDashboardCache<Stats>('stats');

  if (loading) {
    return <DashboardPageLoader label="Loading overview…" compact />;
  }

  const quickLinks = [
    { href: '/dashboard/pending', label: 'Review Pending', icon: Clock, desc: 'Accept or deny members' },
    { href: '/dashboard/leaderboard', label: 'Staff Leaderboard', icon: Trophy, desc: 'Top verifiers' },
    { href: '/dashboard/stats', label: 'Server Analytics', icon: BarChart3, desc: 'Peak times & trends' },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Overview</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Real-time verification system metrics</p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md ${
            stats?.botOnline
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
          }`}
        >
          {stats?.botOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          Bot {stats?.botOnline ? 'Online' : 'Offline'}
          {stats?.botLatencyMs ? ` · ${stats.botLatencyMs}ms` : ''}
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Verified Members" value={stats?.verified ?? 0} icon={ShieldCheck} delay={0} accent="success" />
        <StatCard label="Pending Review" value={stats?.pending ?? 0} icon={Clock} delay={0} accent="warning" />
        <StatCard label="Accepted" value={stats?.accepted ?? 0} icon={CheckCircle} delay={0} />
        <StatCard label="Denied" value={stats?.denied ?? 0} icon={XCircle} delay={0} accent="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Blacklisted" value={stats?.blacklisted ?? 0} icon={Ban} delay={0} accent="danger" />
        <StatCard label="Total Actions" value={stats?.totalActions ?? 0} icon={Activity} delay={0} />
        <StatCard label="Today" value={stats?.todayActions ?? 0} icon={Users} delay={0} />
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickLinks.map((link, i) => {
            const Icon = link.icon;
            return (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
                whileHover={{ y: -4, scale: 1.01 }}
              >
                <Link href={link.href} prefetch className="glass-panel group flex items-center gap-4 p-5">
                  <motion.div
                    whileHover={{ rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 0.45 }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/40 bg-white/30 backdrop-blur dark:border-white/10 dark:bg-white/5"
                  >
                    <Icon size={20} className="text-zinc-600 dark:text-zinc-300" />
                  </motion.div>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">{link.label}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{link.desc}</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
