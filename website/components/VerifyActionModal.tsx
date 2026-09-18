'use client';

import { useEffect, useState } from 'react';
import {
  Loader2, Radio, Server, ShieldCheck, Link2, UserPlus, CheckCircle2, XCircle,
  Clock, Infinity as InfinityIcon, ChevronRight, ChevronLeft, AlertTriangle,
} from 'lucide-react';

interface User {
  discord_id: string;
  username: string;
  global_name: string | null;
}

interface InviteInfo {
  available: boolean;
  inviteCode?: string;
  inviterId?: string;
  inviterUsername?: string;
  inviterAvatar?: string;
  active?: boolean;
  joinedAt?: string;
}

type DurationUnit = 'minutes' | 'hours' | 'days' | 'months';
type AcceptStep = 'invite' | 'duration' | 'reason';
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

  // Accept-only multi-step state
  const [acceptStep, setAcceptStep] = useState<AcceptStep>('invite');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [isPermanent, setIsPermanent] = useState(true);
  const [durationValue, setDurationValue] = useState(7);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [denyError, setDenyError] = useState('');

  useEffect(() => {
    if (!open) {
      setPhase('form');
      setProgress(0);
      setStatusText('Contacting verification system…');
      setAcceptStep('invite');
      setInviteInfo(null);
      setIsPermanent(true);
      setDurationValue(7);
      setDurationUnit('days');
      setDenyError('');
      return;
    }
    if (open && type === 'accept' && user) {
      setInviteLoading(true);
      fetch(`/api/invite-info?userId=${user.discord_id}`)
        .then((r) => r.json())
        .then((data) => setInviteInfo(data))
        .catch(() => setInviteInfo({ available: false }))
        .finally(() => setInviteLoading(false));
    }
  }, [open, type, user]);

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
          durationUnit: isPermanent ? 'permanent' : durationUnit,
          durationValue: isPermanent ? undefined : durationValue,
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
    if (reason.trim().length < 3) {
      setDenyError('Please enter a reason (at least 3 characters) before denying.');
      return;
    }
    setDenyError('');
    setPhase('submitting');
    try {
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: user.discord_id,
          action: 'deny',
          reason: reason.trim(),
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

        {/* ── Step indicator (accept only) ────────────────────────────── */}
        {phase === 'form' && type === 'accept' && (
          <div className="mt-4 flex items-center gap-1.5">
            {(['invite', 'duration', 'reason'] as AcceptStep[]).map((step, i) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  (['invite', 'duration', 'reason'] as AcceptStep[]).indexOf(acceptStep) >= i
                    ? 'bg-emerald-500'
                    : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Step 1: Invite info (accept only) ───────────────────────── */}
        {phase === 'form' && type === 'accept' && acceptStep === 'invite' && (
          <div className="mt-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Link2 size={13} /> Join info
            </p>

            {inviteLoading && (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-400 dark:border-zinc-700">
                <Loader2 size={15} className="animate-spin" /> Looking up how they joined…
              </div>
            )}

            {!inviteLoading && inviteInfo && !inviteInfo.available && (
              <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Invite info not available — they likely joined before invite tracking was enabled, or used a vanity URL.
              </div>
            )}

            {!inviteLoading && inviteInfo?.available && (
              <div className="space-y-2.5 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-700 dark:bg-zinc-950">
                <div className="flex items-center gap-2.5">
                  <img
                    src={inviteInfo.inviterAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                    alt=""
                    className="h-9 w-9 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-medium text-zinc-900 dark:text-white">
                      <UserPlus size={12} className="shrink-0 text-zinc-400" /> {inviteInfo.inviterUsername || 'Unknown inviter'}
                    </p>
                    <p className="truncate text-[11px] text-zinc-400">Invite code: {inviteInfo.inviteCode || '—'}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      inviteInfo.active
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {inviteInfo.active ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {inviteInfo.active ? 'Active' : 'Expired'}
                  </span>
                </div>
                {inviteInfo.joinedAt && (
                  <p className="text-[11px] text-zinc-400">Joined {new Date(inviteInfo.joinedAt).toLocaleString()}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Duration picker (accept only) ───────────────────── */}
        {phase === 'form' && type === 'accept' && acceptStep === 'duration' && (
          <div className="mt-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Clock size={13} /> Verification length
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPermanent(true)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                  isPermanent
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                    : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
                }`}
              >
                <InfinityIcon size={16} />
                <span className="text-xs font-bold">Permanent</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPermanent(false)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                  !isPermanent
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                    : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
                }`}
              >
                <Clock size={16} />
                <span className="text-xs font-bold">Temporary</span>
              </button>
            </div>

            {!isPermanent && (
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={durationValue}
                  onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                </select>
              </div>
            )}
            {!isPermanent && (
              <p className="mt-2 text-[11px] text-zinc-400">
                Verification auto-expires after {durationValue} {durationValue === 1 ? durationUnit.slice(0, -1) : durationUnit} — the user is DM'd and reset to unverified.
              </p>
            )}
          </div>
        )}

        {/* ── Step 3 / deny: reason ───────────────────────────────────── */}
        {phase === 'form' && (type === 'deny' || acceptStep === 'reason') && (
          <>
            {type === 'accept' && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3 py-2.5 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                <Server size={14} className="mt-0.5 shrink-0" />
                On confirm, the portal will ping the bot host and wait for it to wake (~15s on cold start).
              </p>
            )}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Reason {type === 'deny' && <span className="text-red-500">(required)</span>}
            </p>
            <textarea
              className={`mt-1.5 w-full resize-none rounded-xl border bg-white p-3 text-sm dark:bg-zinc-950 dark:text-zinc-100 ${
                denyError ? 'border-red-400 dark:border-red-700' : 'border-zinc-200 dark:border-zinc-700'
              }`}
              rows={3}
              placeholder={type === 'deny' ? 'Why is this request being denied?' : 'Enter reason…'}
              value={reason}
              onChange={(e) => {
                onReasonChange(e.target.value);
                if (denyError) setDenyError('');
              }}
              disabled={busy}
            />
            {denyError && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                <AlertTriangle size={12} /> {denyError}
              </p>
            )}
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
          {phase === 'form' && type === 'accept' && acceptStep !== 'invite' ? (
            <button
              type="button"
              onClick={() => setAcceptStep(acceptStep === 'reason' ? 'duration' : 'invite')}
              className="flex items-center justify-center gap-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-700"
            >
              <ChevronLeft size={15} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm disabled:opacity-40 dark:border-zinc-700"
            >
              Cancel
            </button>
          )}

          {phase === 'form' && type === 'accept' && acceptStep !== 'reason' && (
            <button
              type="button"
              onClick={() => setAcceptStep(acceptStep === 'invite' ? 'duration' : 'reason')}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Next <ChevronRight size={15} />
            </button>
          )}

          {phase === 'form' && (type === 'deny' || acceptStep === 'reason') && (
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
