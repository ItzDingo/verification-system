'use client';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  delay?: number;
  accent?: 'default' | 'success' | 'warning' | 'danger';
}

const accentStyles = {
  default: 'from-zinc-900/8 to-transparent dark:from-white/8',
  success: 'from-emerald-500/15 to-transparent',
  warning: 'from-amber-500/15 to-transparent',
  danger: 'from-red-500/15 to-transparent',
};

export default function StatCard({ label, value, icon: Icon, delay = 0, accent = 'default' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.25 } }}
      className="glass-panel group p-5"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentStyles[accent]}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
          <motion.p
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.15, duration: 0.35 }}
            className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white"
          >
            {value}
          </motion.p>
        </div>
        <motion.div
          whileHover={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.45 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/40 text-zinc-600 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
        >
          <Icon size={18} strokeWidth={2} />
        </motion.div>
      </div>
    </motion.div>
  );
}
