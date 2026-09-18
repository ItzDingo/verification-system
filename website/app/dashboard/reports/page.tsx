'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flag, Send, CheckCircle2, AlertTriangle, Bot, Globe, ShieldAlert, ShieldQuestion,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'bot', label: 'Bot Issue', desc: 'Something broken', Icon: Bot },
  { id: 'website', label: 'Website Bug', desc: 'Dashboard problem', Icon: Globe },
  { id: 'verification', label: 'Verification', desc: 'Verify flow issue', Icon: ShieldQuestion },
  { id: 'security', label: 'Security', desc: 'Abuse / security', Icon: ShieldAlert },
  { id: 'general', label: 'General', desc: 'Anything else', Icon: Flag },
];

export default function ReportsPage() {
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit');
        return;
      }
      setSuccess(true);
      setMessage('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-lg"
        >
          <Flag size={20} />
        </motion.div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Report a Problem</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Submit an issue and the bot will DM the owner instantly.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-5 sm:p-6"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">Category</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CATEGORIES.map((c) => (
            <motion.button
              key={c.id}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setCategory(c.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition ${
                category === c.id
                  ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg dark:border-white dark:bg-white dark:text-zinc-900'
                  : 'border-zinc-200 bg-white/60 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-300'
              }`}
            >
              <c.Icon size={18} />
              <span className="text-xs font-bold">{c.label}</span>
              <span className={`text-[10px] leading-tight ${category === c.id ? 'opacity-70' : 'text-zinc-400'}`}>
                {c.desc}
              </span>
            </motion.button>
          ))}
        </div>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-zinc-400">What happened?</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={1500}
          placeholder="Describe the problem… what did you click, what did you expect, what error did you see?"
          className="w-full resize-y rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
          <span>Min 10 characters — include IDs / details if you can.</span>
          <span className="tabular-nums">{message.length}/1500</span>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-red-500">
            <AlertTriangle size={15} /> {error}
          </p>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={loading || message.trim().length < 10}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Send size={15} />
          )}
          {loading ? 'Sending to owner…' : 'Send Report to Owner'}
        </motion.button>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              <span>Report submitted. The owner has been notified.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
