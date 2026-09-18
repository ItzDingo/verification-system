'use client';
import { signIn, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Sparkles, Lock, Zap } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LoginPanelIllustration from '@/components/LoginPanelIllustration';

const devBypass =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';

const features = [
  { icon: Shield, text: 'Secure Discord OAuth' },
  { icon: Zap, text: 'Real-time verification sync' },
  { icon: Lock, text: 'Staff-only access control' },
];

export default function Home() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRedirected = useRef(false);
  const devSignInStarted = useRef(false);
  const [devSignInError, setDevSignInError] = useState('');

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) console.error('[Home] Auth error:', errorParam);
  }, [searchParams]);

  useEffect(() => {
    if (status === 'authenticated' && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/dashboard');
    }
  }, [status, router]);

  const runDevSignIn = () => {
    setDevSignInError('');
    devSignInStarted.current = true;
    signIn('dev-bypass', { callbackUrl: '/dashboard' }).then((result) => {
      if (result?.error) {
        devSignInStarted.current = false;
        setDevSignInError('Dev sign-in failed. Check NEXTAUTH_SECRET in website/.env.local and restart the dev server.');
      }
    });
  };

  useEffect(() => {
    if (!devBypass || status !== 'unauthenticated' || devSignInStarted.current) return;
    runDevSignIn();
  }, [status]);

  if (devBypass && status !== 'authenticated') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 px-4 dark:bg-zinc-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-8 w-8 rounded-full border-2 border-zinc-900 border-t-transparent dark:border-zinc-300 dark:border-t-transparent"
        />
        <p className="text-sm text-zinc-500">Entering dev dashboard…</p>
        {devSignInError && (
          <div className="max-w-sm text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{devSignInError}</p>
            <button
              type="button"
              onClick={runDevSignIn}
              className="mt-3 text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
            >
              Retry dev login
            </button>
          </div>
        )}
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-8 w-8 rounded-full border-2 border-zinc-900 border-t-transparent dark:border-zinc-300 dark:border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-50/80 dark:bg-zinc-950/90">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(24,24,27,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(250,250,250,0.06),transparent)]" />
      <motion.div
        className="pointer-events-none absolute -left-32 top-20 h-64 w-64 rounded-full bg-zinc-900/5 blur-3xl dark:bg-white/5"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -right-32 bottom-20 h-72 w-72 rounded-full bg-zinc-900/5 blur-3xl dark:bg-white/5"
        animate={{ x: [0, -25, 0], y: [0, 15, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row lg:items-stretch lg:gap-8 lg:px-6 lg:py-10">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="relative hidden min-h-0 flex-col self-stretch overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-10 text-white shadow-2xl dark:border-zinc-800 dark:from-zinc-100 dark:via-zinc-100 dark:to-zinc-200 dark:text-zinc-900 lg:flex lg:w-[44%]"
        >
          <div className="shrink-0">
            <motion.div
              whileHover={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 dark:bg-zinc-900/10"
            >
              <Sparkles className="h-6 w-6" />
            </motion.div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight">Verification Console</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-300 dark:text-zinc-600">
              Manage member verification, track staff performance, and monitor server activity — all in one professional workspace.
            </p>
            <ul className="mt-8 space-y-3">
              {features.map(({ icon: Icon, text }, i) => (
                <motion.li
                  key={text}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3 text-sm text-zinc-300 dark:text-zinc-600"
                >
                  <Icon size={16} className="text-zinc-400 dark:text-zinc-500" />
                  {text}
                </motion.li>
              ))}
            </ul>
          </div>
          <div className="flex min-h-[10rem] flex-1 flex-col items-center justify-center py-8">
            <LoginPanelIllustration />
          </div>
          <p className="shrink-0 text-xs font-medium uppercase tracking-widest text-zinc-500">Authorized staff only</p>
        </motion.div>

        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16 lg:py-0">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-visible rounded-3xl border border-zinc-200/80 bg-white/90 p-10 text-center shadow-xl backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90"
          >
            <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
              <ThemeToggle compact />
            </div>
            <div className="absolute left-1/2 top-0 h-1 w-20 -translate-x-1/2 rounded-b-full bg-gradient-to-r from-zinc-700 via-zinc-900 to-zinc-700 dark:from-zinc-200 dark:via-white dark:to-zinc-200" />
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Paradise" className="mx-auto mb-5 h-16 w-16 object-contain drop-shadow-sm" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Paradise</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Sign in with Discord to access the dashboard</p>
            {devBypass ? (
              <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                Dev bypass is on — signing you into the dashboard without Discord…
              </p>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
                className="mt-8 w-full rounded-2xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                Continue with Discord
              </motion.button>
            )}
            {devBypass && (
              <button
                type="button"
                onClick={() => signIn('dev-bypass', { callbackUrl: '/dashboard' })}
                className="mt-3 w-full text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
              >
                Stuck? Click to enter dashboard (dev)
              </button>
            )}
            <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">We only use your Discord account to verify your identity</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
