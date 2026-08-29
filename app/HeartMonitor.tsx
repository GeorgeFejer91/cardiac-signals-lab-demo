'use client';

import { type CSSProperties, useEffect, useRef } from 'react';
import type { HeartAccess } from './gameData';

type HeartMonitorProps = {
  bpm: number;
  access: HeartAccess;
  compact?: boolean;
  label?: string;
  note?: string;
};

export default function HeartMonitor({
  bpm,
  access,
  compact = false,
  label = 'Agent cardiac signal',
  note,
}: HeartMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleBpm = access === 'hidden' ? 0 : bpm;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(220, Math.round(bounds.width));
      const height = Math.max(54, Math.round(bounds.height));
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      context.strokeStyle = 'rgba(255,255,255,.07)';
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 24) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += 18) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      context.beginPath();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 2.2;
      context.strokeStyle = access === 'hidden' ? 'rgba(255,255,255,.25)' : access === 'replay' ? '#f3bb72' : '#78f0dd';
      const time = reducedMotion ? 0 : (now - start) / 1000;
      const rate = Math.max(45, visibleBpm || 72) / 60;
      for (let x = 0; x <= width; x += 2) {
        let y = height * 0.55;
        if (access !== 'hidden') {
          const cycle = ((x / width) * 3.1 - time * rate + 8) % 1;
          const q = Math.exp(-Math.pow((cycle - 0.42) / 0.034, 2));
          const r = Math.exp(-Math.pow((cycle - 0.47) / 0.018, 2));
          const s = Math.exp(-Math.pow((cycle - 0.53) / 0.042, 2));
          y += q * 5 - r * 24 + s * 8;
        }
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      if (!reducedMotion) frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [access, visibleBpm]);

  const beatStyle = {
    '--beat-duration': `${60 / Math.max(45, bpm || 72)}s`,
  } as CSSProperties;

  return (
    <section className={`heart-monitor ${compact ? 'compact' : ''} access-${access}`} aria-label={label}>
      <div className="monitor-heading">
        <span className="monitor-source"><i /> {label}</span>
        <span className="monitor-mode">{access === 'live' ? 'LIVE' : access === 'replay' ? 'REPLAY' : 'HIDDEN'}</span>
      </div>
      <div className="monitor-body">
        <span className="pulse-heart" style={beatStyle} aria-hidden="true">♥</span>
        <canvas ref={canvasRef} aria-hidden="true" />
        <output aria-label={access === 'hidden' ? 'Heart rate hidden' : `${bpm} beats per minute`}>
          <strong>{access === 'hidden' ? '—' : bpm}</strong>
          <span>BPM</span>
        </output>
      </div>
      {note ? <p className="monitor-note">{note}</p> : null}
    </section>
  );
}
