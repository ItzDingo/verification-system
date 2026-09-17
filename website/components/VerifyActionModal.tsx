'use client';

import { useEffect, useState } from 'react';
import { Loader2, Radio, Server, ShieldCheck } from 'lucide-react';

interface User {
  discord_id: string;
  username: string;
  global_name: string | null;
}

type Phase = 'form' | 'waking' | 'submitting';

const WAKE_MAX_MS = 15_000;

export default function VerifyActionModal({
  open,
  type,
  user,
  reason,
  onReasonChange,
  onClose,
  onComplete,
}: {
  open: boolean;
  type: 'accept' | 'deny';
  user?: User;
  reason: string;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onComplete: (result: { ok: boolean; data: Record<string, unknown> }) => void;
}) {
  const [phase, setPhase] = useState<Phase>('form');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Contacting verification system…');

  useEffect(() => {
    if (!open) {
      setPhase('form');
      setProgress(0);
      setStatusText('Contacting verification system…');
    }
  }, [open]);

  useEffect(() => {
    if (phase !== 'waking') return;

    const started = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const pct = Math.min(95, (elapsed / WAKE_MAX_MS) * 100);
      setProgress(pct);
      if (elapsed > 4000 && elapsed < 10000) {
        setStatusText('Waking bot server (this can take ~15s)…');
      } else if (elapsed >= 10000) {
        setStatusText('Almost ready — confirming bot connection…');
      }
    }, 100);

    return () => clearInterval(tick);
  }, [phase]);

  const runAccept = async () => {
    if (!user) return;
    setPhase('waking');
    setProgress(8);

    try {
      const wakeRes = await fetch('/api/bot/wake', { method: 'POST' });
      const wakeData = await wakeRes.json();

      if (!wakeRes.ok) {
        onComplete({ ok: false, data: wakeData });
        return;
      }

      setProgress(100);
      setStatusText('Bot online — registering verification…');
      setPhase('submitting');

      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: user.discord_id,
          action: 'accept',
          reason: reason.trim() || 'Verified by Staff',
        }),
      });
      const verifyData = await verifyRes.json();
      onComplete({ ok: verifyRes.ok, data: verifyData });
    } catch {
      onComplete({ ok: false, data: { error: 'Network error while contacting the verification system.' } });
    }
  };

  const runDeny = async () => {
    if (!user) return;
    setPhase('submitting');
    try {
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: user.discord_id,
          action: 'deny',
          reason: reason.trim() || 'Denied by Staff',
        }),
      });
      const verifyData = await verifyRes.json();
      onComplete({ ok: verifyRes.ok, data: verifyData });
    } catch {
      onComplete({ ok: false, data: { error: 'Network error.' } });
    }
  };

  const handleConfirm = () => {
    if (type === 'accept') runAccept();
    else runDeny();
  };

  if (!open || !user) return null;

  const busy = phase !== 'form';
  const displayName = user.global_name || user.username;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
          {type === 'accept' ? 'Accept verification' : 'Deny verification'}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          {displayName} · @{user.username}
        </p>

        {phase === 'form' && (
          <>
            {type === 'accept' && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3 py-2.5 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                <Server size={14} className="mt-0.5 shrink-0" />
                On confirm, the portal will ping the bot host and wait for it to wake (~15s on cold start).
              </p>
            )}
            <textarea
              className="mt-4 w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              rows={3}
              placeholder="Enter reason…"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              disabled={busy}
            />
          </>
        )}

        {(phase === 'waking' || phase === 'submitting') && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                {phase === 'waking' ? (
                  <Radio size={18} className="animate-pulse text-blue-600 dark:text-blue-400" />
                ) : (
                  <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{statusText}</p>
                <p className="text-xs text-zinc-500">
                  {phase === 'waking' ? 'Pinging bot host & waiting for ready status' : 'Saving verification to database'}
                </p>
              </div>
              <Loader2 size={18} className="animate-spin text-zinc-400" />
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-[width] duration-300 ease-out"
                style={{ width: `${phase === 'submitting' ? 100 : progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm disabled:opacity-40 dark:border-zinc-700"
          >
            Cancel
          </button>
          {phase === 'form' && (
            <button
              type="button"
              onClick={handleConfirm}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white ${
                type === 'accept' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {type === 'accept' ? 'Confirm & verify' : 'Confirm deny'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
