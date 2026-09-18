'use client';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LogOut, Users, Clock, FileText, Ban, LayoutDashboard, Trophy, BarChart3, Flag, Menu, X,
} from 'lucide-react';
import { Session } from 'next-auth';
import ThemeToggle from '@/components/ThemeToggle';
import { prefetchAllDashboardData, prefetchDashboardRoute } from '@/lib/dashboard-cache';

interface CustomUser {
  discordId?: string | null;
  username?: string | null;
  globalName?: string | null;
  avatar?: string | null;
  isStaff?: boolean;
  isDevBypass?: boolean;
  highestRole?: string | null;
  roleColor?: number;
}

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/pending', label: 'Pending', icon: Clock },
  { href: '/dashboard/members', label: 'Members', icon: Users },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/dashboard/stats', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/logs', label: 'Logs', icon: FileText },
  { href: '/dashboard/blacklist', label: 'Blacklist', icon: Ban },
  { href: '/dashboard/reports', label: 'Report', icon: Flag },
];

function roleColorStyle(color: number) {
  if (!color) return {};
  return { color: `#${color.toString(16).padStart(6, '0')}` };
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  index,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  index: number;
  onNavigate?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        href={href}
        prefetch
        onClick={onNavigate}
        onMouseEnter={() => prefetchDashboardRoute(href)}
        onFocus={() => prefetchDashboardRoute(href)}
        className={`glass-nav-item relative ${active ? 'glass-nav-item-active' : ''}`}
      >
        <Icon size={18} className="shrink-0 opacity-90" />
        <span>{label}</span>
        {active && (
          <motion.span
            layoutId="nav-glow"
            className="absolute inset-0 -z-10 rounded-xl ring-1 ring-white/20 dark:ring-white/10"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
      </Link>
    </motion.div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() as {
    data: Session & { user: CustomUser } | null;
    status: 'loading' | 'authenticated' | 'unauthenticated';
  };

  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<{ role: string; roleColor: number; discordId: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (session && !session.user?.isStaff && !session.user?.isDevBypass) {
      signOut({ callbackUrl: '/' });
    }
  }, [session, status, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/me')
        .then((r) => r.json())
        .then((data) => {
          if (data.discordId) setProfile(data);
        })
        .catch(() => {});
      links.forEach((link) => router.prefetch(link.href));
      prefetchAllDashboardData();
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-transparent dark:border-zinc-200" />
      </div>
    );
  }

  const displayName =
    session?.user?.globalName?.trim() ||
    session?.user?.username?.trim() ||
    'Staff';

  const roleName = profile?.role || session?.user?.highestRole || 'Staff';
  const roleColor = profile?.roleColor ?? session?.user?.roleColor ?? 0;
  const username = session?.user?.username || 'staff';
  const avatar = session?.user?.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const sidebar = (
    <>
      <div className="flex items-center gap-3 border-b border-white/30 px-4 py-5 dark:border-white/10">
        <motion.div
          whileHover={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 0.5 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900/90 shadow-lg backdrop-blur dark:bg-white/90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Paradise" className="h-6 w-6 object-contain" />
        </motion.div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">Paradise</p>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Verification</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {links.map((link, index) => (
          <NavLink
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            index={index}
            active={isActive(link.href)}
            onNavigate={() => setMobileNavOpen(false)}
          />
        ))}
      </nav>

      <div className="border-t border-white/30 p-4 dark:border-white/10">
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="glass-chip p-3"
        >
          <div className="flex items-center gap-3">
            <img src={avatar} alt="" className="h-11 w-11 shrink-0 rounded-full border border-white/50 object-cover dark:border-zinc-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{displayName}</p>
              <p className="truncate text-xs text-zinc-500">@{username}</p>
              <p className="mt-0.5 truncate text-xs font-medium" style={roleColorStyle(roleColor)}>
                {roleName}
              </p>
            </div>
          </div>
        </motion.div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <ThemeToggle compact />
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => signOut({ callbackUrl: '/' })}
            className="glass-nav-item inline-flex items-center gap-2 px-3 py-2 text-xs"
            title="Sign out"
          >
            <LogOut size={14} />
            Sign out
          </motion.button>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen text-zinc-900 dark:text-zinc-100">
      <div className="relative z-[1] mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="glass-sidebar hidden w-64 shrink-0 flex-col border-r lg:flex">
          {sidebar}
        </aside>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/30 backdrop-blur-md"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="glass-sidebar relative flex h-full w-[min(100%,280px)] flex-col border-r shadow-2xl"
            >
              <button
                type="button"
                className="absolute right-3 top-4 rounded-lg p-2 text-zinc-500 hover:bg-white/30 dark:hover:bg-white/10"
                onClick={() => setMobileNavOpen(false)}
              >
                <X size={20} />
              </button>
              {sidebar}
            </motion.aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-header sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
            <button
              type="button"
              className="glass-nav-item rounded-xl p-2"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <p className="text-sm font-semibold">Paradise</p>
            <img src={avatar} alt="" className="h-9 w-9 rounded-full border border-white/40 dark:border-zinc-600" />
          </header>

          {process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true' && (
            <div className="border-b border-amber-200/50 bg-amber-50/60 px-4 py-2 text-center text-xs font-medium text-amber-900 backdrop-blur-md dark:border-amber-900/30 dark:bg-amber-950/35 dark:text-amber-200">
              Local dev mode — auth bypass active
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
