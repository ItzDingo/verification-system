'use client';

import { useEffect, useRef } from 'react';

const HEX_R = 22;
const DX = Math.sqrt(3) * HEX_R;
const DY = 1.5 * HEX_R;

function hexPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  ox: number,
  oy: number
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + ox + r * Math.cos(a);
    const y = cy + oy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export default function DashboardAmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1e9, y: -1e9 });
  const darkRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const readDark = () =>
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    let raf = 0;
    let t = 0;

    const loop = () => {
      t += 0.012;
      darkRef.current = readDark();

      const w = window.innerWidth;
      const h = window.innerHeight;
      const rect = canvas.getBoundingClientRect();
      const mx = mouseRef.current.x - rect.left;
      const my = mouseRef.current.y - rect.top;
      const influenceR = 220;

      ctx.clearRect(0, 0, w, h);

      const base = darkRef.current
        ? 'rgba(161,161,170,0.14)'
        : 'rgba(82,82,91,0.12)';
      const hot = darkRef.current
        ? 'rgba(228,228,231,0.38)'
        : 'rgba(24,24,27,0.35)';

      const cols = Math.ceil(w / DX) + 3;
      const rows = Math.ceil(h / DY) + 3;
      const padX = -DX;
      const padY = -DY;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let cx = padX + col * DX + (row % 2) * (DX / 2);
          let cy = padY + row * DY;

          const driftX = Math.sin(t * 0.35 + row * 0.08 + col * 0.05) * 3;
          const driftY = Math.cos(t * 0.28 + col * 0.07) * 2.5;
          cx += driftX;
          cy += driftY;

          const dx = cx - mx;
          const dy = cy - my;
          const dist = Math.hypot(dx, dy);
          let ox = 0;
          let oy = 0;
          let pulse = 0;
          if (dist < influenceR && dist > 0.001) {
            const f = (influenceR - dist) / influenceR;
            const push = f * 14;
            ox = (dx / dist) * push;
            oy = (dy / dist) * push;
            pulse = f;
          }

          hexPath(ctx, cx, cy, HEX_R, ox, oy);
          ctx.strokeStyle = pulse > 0.08 ? hot : base;
          ctx.lineWidth = 0.85 + pulse * 1.4;
          ctx.stroke();
        }
      }

      // Moving guide lines (subtle)
      ctx.save();
      ctx.globalAlpha = darkRef.current ? 0.09 : 0.08;
      ctx.strokeStyle = darkRef.current ? '#fafafa' : '#18181b';
      ctx.lineWidth = 1;
      const lineOffset = (t * 18) % 120;
      for (let x = -lineOffset; x < w + 120; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h * 0.35, h);
        ctx.stroke();
      }
      ctx.restore();

      raf = requestAnimationFrame(loop);
    };

    resize();
    darkRef.current = readDark();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(loop);

    const mo = new MutationObserver(() => {
      darkRef.current = readDark();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      mo.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-[5] h-full w-full"
      aria-hidden
    />
  );
}
