'use client';

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import type { HeartAccess } from './gameData';
import { nearestNeurokitProfile, neurokitVersion } from './neurokitProfiles';

type HeartMonitorProps = {
  bpm: number;
  access: HeartAccess;
  compact?: boolean;
  label?: string;
  note?: string;
};

type DisplayMode = 'ecg' | 'pulse' | 'affect' | 'heart';

const displayModes: Array<{ id: DisplayMode; label: string; glyph: string }> = [
  { id: 'ecg', label: 'ECG', glyph: '⌁' },
  { id: 'pulse', label: 'Pulse', glyph: '•' },
  { id: 'affect', label: 'Affect', glyph: '◎' },
  { id: 'heart', label: 'Heart', glyph: '♥' },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export default function HeartMonitor({
  bpm,
  access,
  compact = false,
  label = 'Agent cardiac signal',
  note,
}: HeartMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('ecg');
  const visibleBpm = access === 'hidden' ? 0 : bpm;
  const profile = useMemo(() => nearestNeurokitProfile(bpm || 72), [bpm]);
  const rrInterval = visibleBpm ? profile.meanRrMs : 0;
  const baselineDelta = visibleBpm ? visibleBpm - 72 : 0;
  const activation = visibleBpm
    ? clamp(Math.round(50 + baselineDelta * 2.8 - (profile.rmssdMs - 45) * 0.35), 0, 100)
    : 0;
  const activationBand = activation < 34 ? 'quiet' : activation < 67 ? 'engaged' : 'high';

  useEffect(() => {
    if (displayMode !== 'ecg') return;
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
      const height = Math.max(66, Math.round(bounds.height));
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
      context.lineWidth = 2.1;
      context.strokeStyle = access === 'hidden' ? 'rgba(255,255,255,.25)' : access === 'replay' ? '#f3bb72' : '#78f0dd';
      const elapsed = reducedMotion ? 0 : (now - start) / 1000;
      const offset = Math.floor(elapsed * (profile.samples.length / 8));
      for (let x = 0; x <= width; x += 2) {
        const sampleIndex = (Math.floor((x / width) * profile.samples.length) + offset) % profile.samples.length;
        const sample = access === 'hidden' ? 0 : profile.samples[sampleIndex];
        const y = height * 0.54 - sample * height * 0.36;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      if (!reducedMotion) frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [access, displayMode, profile]);

  const beatStyle = {
    '--beat-duration': `${60 / Math.max(45, bpm || 72)}s`,
  } as CSSProperties;
  const affectStyle = {
    '--activation': `${activation * 3.6}deg`,
    '--affect-scale': `${0.82 + activation / 500}`,
  } as CSSProperties;

  const hiddenValue = (value: string | number) => access === 'hidden' ? '—' : value;

  return (
    <section className={`heart-monitor ${compact ? 'compact' : ''} access-${access}`} aria-label={label}>
      <div className="monitor-heading">
        <span className="monitor-source"><i /> {label}</span>
        <span className="monitor-mode">{access === 'live' ? 'LIVE' : access === 'replay' ? 'REPLAY' : 'HIDDEN'}</span>
      </div>

      <div className="monitor-view-switch" role="group" aria-label="Cardiac display style">
        {displayModes.map((mode) => (
          <button
            className={displayMode === mode.id ? 'selected' : ''}
            type="button"
            aria-pressed={displayMode === mode.id}
            onClick={() => setDisplayMode(mode.id)}
            key={mode.id}
          >
            <i aria-hidden="true">{mode.glyph}</i>{mode.label}
          </button>
        ))}
      </div>

      {displayMode === 'ecg' ? (
        <div className="monitor-view ecg-view">
          <div className="ecg-label"><span>NeuroKit ECGSYN</span><small>v{neurokitVersion} · synthetic</small></div>
          <canvas ref={canvasRef} aria-hidden="true" />
          <div className="metric-ribbon">
            <span><small>Rate</small><strong>{hiddenValue(bpm)}</strong><i>BPM</i></span>
            <span><small>Beat interval</small><strong>{hiddenValue(rrInterval)}</strong><i>MS</i></span>
            <span><small>Variability</small><strong>{hiddenValue(profile.rmssdMs)}</strong><i>RMSSD</i></span>
          </div>
        </div>
      ) : null}

      {displayMode === 'pulse' ? (
        <div className="monitor-view pulse-view">
          <div className="pulse-orbit" style={beatStyle} aria-hidden="true"><i /><i /><i /></div>
          <output aria-label={access === 'hidden' ? 'Heart rate hidden' : `${bpm} beats per minute`}>
            <strong>{hiddenValue(bpm)}</strong><span>BPM</span>
            <small>{access === 'hidden' ? 'signal unavailable' : `${rrInterval} ms between beats`}</small>
          </output>
          <div className="beat-train" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i style={{ animationDelay: `${index * .11}s` }} key={index} />)}</div>
        </div>
      ) : null}

      {displayMode === 'affect' ? (
        <div className="monitor-view affect-view">
          <div className="affect-orb" style={affectStyle} aria-hidden="true"><i /><span>{access === 'hidden' ? '—' : activation}</span></div>
          <div className="affect-copy">
            <small>Affect Tracker–style lens</small>
            <strong>{access === 'hidden' ? 'Signal hidden' : `${activationBand} activation`}</strong>
            <span>{hiddenValue(baselineDelta > 0 ? `+${baselineDelta}` : baselineDelta)} BPM from demo baseline</span>
          </div>
          <div className="activation-meter" aria-label={access === 'hidden' ? 'Activation proxy hidden' : `Activation proxy ${activation} out of 100`}>
            <i style={{ width: `${access === 'hidden' ? 0 : activation}%` }} />
          </div>
          <p>HR-derived activation proxy only. It does not infer valence, excitement, emotion, or truth.</p>
        </div>
      ) : null}

      {displayMode === 'heart' ? (
        <div className="monitor-view heart-view">
          <div className="heart-stage" style={beatStyle} aria-hidden="true">
            <span>♥</span><b>{hiddenValue(bpm)}</b><small>BPM</small>
          </div>
          <div className="heart-readout">
            <span><small>Beat interval</small><strong>{hiddenValue(rrInterval)} <i>ms</i></strong></span>
            <span><small>Baseline shift</small><strong>{hiddenValue(baselineDelta > 0 ? `+${baselineDelta}` : baselineDelta)} <i>bpm</i></strong></span>
            <span><small>Signal source</small><strong>{access === 'hidden' ? 'masked' : 'synthetic'} <i>ECG</i></strong></span>
          </div>
        </div>
      ) : null}

      {note ? <p className="monitor-note">{note}</p> : null}
    </section>
  );
}
