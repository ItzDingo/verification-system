'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, X } from 'lucide-react';

export interface VerifyResult {
  success: boolean;
  title: string;
  message?: string;
  details?: { label: string; value: string }[];
}

interface ResultModalProps {
  result: VerifyResult | null;
  onClose: () => void;
}

export default function ResultModal({ result, onClose }: ResultModalProps) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div
              className={`h-1 w-full ${result.success ? 'bg-emerald-500' : 'bg-red-500'}`}
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="p-6 pt-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                {result.success ? (
                  <CheckCircle2 className="text-emerald-500" size={32} />
                ) : (
                  <XCircle className="text-red-500" size={32} />
                )}
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{result.title}</h3>
              {result.message && (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{result.message}</p>
              )}
              {result.details && result.details.length > 0 && (
                <div className="mt-5 space-y-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 text-left dark:border-zinc-800 dark:bg-zinc-950/50">
                  {result.details.map((d) => (
                    <div key={d.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{d.label}</span>
                      <span className="break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">{d.value}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
