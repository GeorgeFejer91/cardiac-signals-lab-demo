'use client';

import { type CSSProperties, useMemo } from 'react';
import type { HeartAccess } from './gameData';
import { nearestNeurokitProfile } from './neurokitProfiles';

export type CardiacDisplayMode = 'heart' | 'glow';
export type CardiacCueMeaning = 'confidence' | 'recognition';

type HeartMonitorProps = {
  bpm: number;
  access: HeartAccess;
  compact?: boolean;
  label?: string;
  note?: string;
  displayMode: CardiacDisplayMode;
  onDisplayModeChange: (mode: CardiacDisplayMode) => void;
  cueMeaning: CardiacCueMeaning;
};

const displayModes: Array<{ id: CardiacDisplayMode; label: string; glyph: string }> = [
  { id: 'heart', label: 'Heart cue', glyph: '♥' },
  { id: 'glow', label: 'Card glow', glyph: '▱' },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function cardiacCueStrength(bpm: number, access: HeartAccess, cueMeaning: CardiacCueMeaning) {
  if (access === 'hidden') return 0;
  if (cueMeaning === 'confidence') return clamp(Math.round(42 + (bpm - 70) * 3.1), 18, 96);
  return clamp(Math.round(32 + Math.abs(bpm - 78) * 6.2), 18, 96);
}

export default function HeartMonitor({
  bpm,
  access,
  compact = false,
  label = 'Other player · cardiac cue',
  note,
  displayMode,
  onDisplayModeChange,
  cueMeaning,
}: HeartMonitorProps) {
  const profile = useMemo(() => nearestNeurokitProfile(bpm || 72), [bpm]);
  const cueStrength = cardiacCueStrength(bpm, access, cueMeaning);
  const cueBand = cueStrength < 40 ? 'subtle' : cueStrength < 70 ? 'moderate' : 'strong';
  const cueLabel = cueMeaning === 'confidence' ? 'confidence cue' : 'recognition-change cue';
  const cueStyle = {
    '--beat-duration': `${profile.meanRrMs / 1000}s`,
    '--cue-strength': `${cueStrength}%`,
    '--cue-alpha': access === 'hidden' ? '.08' : `${0.18 + cueStrength / 155}`,
    '--cue-scale': `${0.84 + cueStrength / 520}`,
  } as CSSProperties;

  return (
    <section className={`heart-monitor stylized-cue ${compact ? 'compact' : ''} access-${access}`} aria-label={label}>
      <div className="monitor-heading">
        <span className="monitor-source"><i /> {label}</span>
        <span className="monitor-mode">{access === 'live' ? 'CONTINGENT' : access === 'replay' ? 'REPLAY' : 'HIDDEN'}</span>
      </div>

      <div className="monitor-view-switch two" role="group" aria-label="Cardiac confidence display style">
        {displayModes.map((mode) => (
          <button
            className={displayMode === mode.id ? 'selected' : ''}
            type="button"
            aria-pressed={displayMode === mode.id}
            onClick={() => onDisplayModeChange(mode.id)}
            key={mode.id}
          >
            <i aria-hidden="true">{mode.glyph}</i>{mode.label}
          </button>
        ))}
      </div>

      <div className={`monitor-view confidence-cue-view ${displayMode}`} style={cueStyle}>
        {displayMode === 'heart' ? (
          <div className="stylized-heart-cue" aria-hidden="true">
            <i className="cue-ring outer" /><i className="cue-ring inner" />
            <span>♥</span>
          </div>
        ) : (
          <div className="glow-card-preview" aria-hidden="true">
            <span className="glow-card-edge"><i /></span>
          </div>
        )}
        <div className="confidence-cue-copy">
          <small>{cueMeaning === 'confidence' ? 'Player A’s public confidence display' : 'Player 1’s public cardiac-change display'}</small>
          <strong>{access === 'hidden' ? 'Cue hidden' : `${cueBand} ${cueLabel}`}</strong>
          <span>{displayMode === 'heart' ? 'Communicated through beat rhythm and animation intensity.' : 'Communicated as light on the active card edge.'}</span>
        </div>
        <div className="cue-strength-meter" aria-label={access === 'hidden' ? 'Cardiac cue hidden' : `${cueBand} ${cueLabel}`}>
          <i />
        </div>
        <p>Stylized from synthetic NeuroKit timing. Raw ECG, BPM, and variability values are not shown to the participant.</p>
      </div>

      {note ? <p className="monitor-note">{note}</p> : null}
    </section>
  );
}
