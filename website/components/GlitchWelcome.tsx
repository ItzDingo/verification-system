'use client';

type GlitchWelcomeProps = {
  displayName: string;
};

export default function GlitchWelcome({ displayName }: GlitchWelcomeProps) {
  const safe = displayName?.trim() || 'Staff';
  const dataText = `Welcome, ${safe}`;

  return (
    <div className="relative">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
        Signed in
      </p>
      <h2
        className="welcome-glitch text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white md:text-3xl"
        data-text={dataText}
      >
        {dataText}
      </h2>
    </div>
  );
}
