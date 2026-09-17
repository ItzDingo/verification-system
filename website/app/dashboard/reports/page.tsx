'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Send, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  { id: 'bot', label: 'Bot Issue' },
  { id: 'website', label: 'Website Bug' },
  { id: 'verification', label: 'Verification Problem' },
  { id: 'security', label: 'Security Concern' },
  { id: 'general', label: 'General' },
];

export default function ReportsPage() {
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message }),
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
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white">
        <Flag size={26} /> Report a Problem
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Submit an issue and the bot will notify the server owner instantly.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Category</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                category === c.id
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Description</label>
        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the problem in detail..."
          className="mb-4 w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
        />

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
          >
            <CheckCircle2 size={18} /> Report submitted. The owner has been notified.
          </motion.div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !message.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Send size={16} />
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </motion.div>
    </div>
  );
}
