'use client';

import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';
import { useTheme } from '@/components/ThemeProvider';

export default function ParticlesBackground() {
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const options = useMemo<ISourceOptions>(() => {
    const isDark = resolvedTheme === 'dark';
    return {
      fullScreen: { enable: false },
      fpsLimit: 120,
      detectRetina: true,
      background: { color: { value: 'transparent' } },
      particles: {
        number: { value: 60, density: { enable: true, width: 900, height: 900 } },
        color: { value: isDark ? ['#fafafa', '#a1a1aa'] : ['#0a0a0a', '#52525b'] },
        shape: { type: 'circle' },
        opacity: { value: isDark ? 0.08 : 0.07 },
        size: { value: { min: 1, max: 3 } },
        move: {
          enable: true,
          speed: 0.6,
          direction: 'none',
          random: false,
          straight: false,
          outModes: { default: 'out' },
        },
        links: {
          enable: true,
          distance: 130,
          color: isDark ? '#fafafa' : '#0a0a0a',
          opacity: isDark ? 0.07 : 0.06,
          width: 0.5,
        },
      },
    };
  }, [resolvedTheme]);

  if (!ready) return null;

  return (
    <Particles
      id="tsparticles"
      options={options}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
