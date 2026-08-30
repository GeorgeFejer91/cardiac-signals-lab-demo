'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';

type ScenarioId = 'signal' | 'dilemma' | 'concealed' | 'ultimatum';
type IncentiveMode = 'cooperate' | 'compete';
type CueMode = 'edge' | 'heart';

type Scenario = {
  id: ScenarioId;
  number: string;
  title: string;
  subtitle: string;
  farCard: string;
  nearCard: string;
  stateCard: string;
  phases: string[];
  accent: string;
};

const scenarios: Scenario[] = [
  {
    id: 'signal',
    number: '01',
    title: 'Hidden Target',
    subtitle: 'One player knows the target and sends a card signal.',
    farCard: 'SUN',
    nearCard: 'SUN',
    stateCard: 'TARGET · SUN',
    phases: ['Private target', 'Signal selected', 'Cardiac cue', 'Receiver chooses', 'Outcome'],
    accent: '#78eadf',
  },
  {
    id: 'dilemma',
    number: '02',
    title: 'Share / Keep',
    subtitle: 'Both players commit privately, then reveal together.',
    farCard: 'SHARE',
    nearCard: 'SHARE',
    stateCard: 'PRIVATE HAND',
    phases: ['Private choice', 'Cards committed', 'Cardiac cue', 'Joint reveal', 'Payoff'],
    accent: '#a9d785',
  },
  {
    id: 'concealed',
    number: '03',
    title: 'Concealed Card',
    subtitle: 'The observer watches timed probes for a cardiac change.',
    farCard: '4♦',
    nearCard: '4♦',
    stateCard: 'PRIVATE · 4♦',
    phases: ['Card concealed', 'Candidates shown', 'Cardiac cue', 'Observer selects', 'Recorded'],
    accent: '#ff8c78',
  },
  {
    id: 'ultimatum',
    number: '04',
    title: 'Offer / Response',
    subtitle: 'An offer card is answered with Accept or Reject.',
    farCard: '7 / 3',
    nearCard: 'ACCEPT',
    stateCard: '10 TOKENS',
    phases: ['Offer prepared', 'Offer placed', 'Cardiac cue', 'Response card', 'Payout'],
    accent: '#d6b6ff',
  },
];

function Avatar({ side, friendly }: { side: 'far' | 'near'; friendly: boolean }) {
  return (
    <div className={`table-avatar ${side}`} aria-hidden="true">
      <span className="avatar-shadow" />
      <span className="avatar-torso"><i /><i /></span>
      <span className="avatar-neck" />
      <span className="avatar-head">
        <img src={`assets/faces/${friendly ? 'happiness' : 'neutral'}.svg`} alt="" />
      </span>
      <span className="avatar-role">{side === 'far' ? 'PARTNER A' : 'YOU · PLAYER B'}</span>
    </div>
  );
}

function TableCard({
  className,
  label,
  cue,
}: {
  className: string;
  label: string;
  cue?: boolean;
}) {
  return (
    <span className={`diorama-card ${className}${cue ? ' cue-active' : ''}`} aria-hidden="true">
      <i className="card-inset" />
      <b>{label}</b>
      {cue ? <i className="cardiac-edge-pulse" /> : null}
    </span>
  );
}

function Diorama({
  scenario,
  phase,
  incentive,
  cueMode,
  compact = false,
}: {
  scenario: Scenario;
  phase: number;
  incentive: IncentiveMode;
  cueMode: CueMode;
  compact?: boolean;
}) {
  const cueVisible = phase === 2 || phase === 3;
  const receiverLabel = scenario.id === 'dilemma' && incentive === 'compete' ? 'KEEP' : scenario.nearCard;
  const outcome = scenario.id === 'ultimatum'
    ? receiverLabel === 'ACCEPT' ? '+7 / +3' : '0 / 0'
    : incentive === 'cooperate' ? 'JOINT +3' : 'A +3 · B 0';

  return (
    <div
      className={`table-diorama scene-${scenario.id} phase-${phase} cue-${cueMode}${compact ? ' compact' : ''}`}
      style={{ '--scene-accent': scenario.accent } as React.CSSProperties}
      aria-label={`${scenario.title}, phase ${phase + 1}: ${scenario.phases[phase]}`}
    >
      <div className="passthrough-hint" aria-hidden="true"><i /> PASSTHROUGH MR · TABLE ANCHOR</div>
      <div className="diorama-depth-grid" aria-hidden="true" />
      <Avatar side="far" friendly={incentive === 'cooperate'} />
      <Avatar side="near" friendly={false} />

      <div className="table-object" aria-hidden="true">
        <span className="table-rim" />
        <span className="table-plane">
          <i className="table-anchor-mark" />
        </span>
        <span className="table-leg left" /><span className="table-leg right" />
      </div>

      <div className="card-space" aria-hidden="true">
        <TableCard className="private-state-card" label={scenario.stateCard} />
        {scenario.id === 'concealed' ? (
          <span className="probe-fan">
            {['7♥', 'Q♠', '4♦', '9♣'].map((card) => (
              <TableCard key={card} className={card === '4♦' ? 'probe-card target-probe' : 'probe-card'} label={card} cue={cueVisible && card === '4♦' && cueMode === 'edge'} />
            ))}
          </span>
        ) : (
          <TableCard className="sender-play-card" label={scenario.farCard} cue={cueVisible && cueMode === 'edge'} />
        )}
        <TableCard className="receiver-play-card" label={receiverLabel} />
        {cueVisible && cueMode === 'heart' ? (
          <span className="floating-heart-cue"><i /><b>♥</b><small>CARDIAC STATE</small></span>
        ) : null}
        <span className="outcome-chip">{outcome}</span>
      </div>

      {!compact ? (
        <div className="phase-caption" role="status" aria-live="polite">
          <span>PHASE {phase + 1} / {scenario.phases.length}</span>
          <strong>{scenario.phases[phase]}</strong>
          <small>{phase === 2 ? 'The cue shows cardiac activity—not confidence or deception.' : scenario.subtitle}</small>
        </div>
      ) : null}
    </div>
  );
}

export default function ExperimentMiniatures() {
  const [selectedId, setSelectedId] = useState<ScenarioId>('signal');
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [incentive, setIncentive] = useState<IncentiveMode>('cooperate');
  const [cueMode, setCueMode] = useState<CueMode>('edge');

  const selected = useMemo(() => scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0], [selectedId]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setPhase((current) => (current + 1) % selected.phases.length), 1900);
    return () => window.clearInterval(timer);
  }, [paused, selected]);

  const chooseScenario = (id: ScenarioId) => {
    setSelectedId(id);
    setPhase(0);
    setPaused(false);
  };

  return (
    <section className="miniature-lab" aria-labelledby="miniature-title">
      <div className="miniature-heading">
        <div>
          <p className="eyebrow">Animated MR study table</p>
          <h2 id="miniature-title">Two people, one table, four decision flows.</h2>
          <p>Watch the cards travel from private hands to the shared table. In the experiment, the red pulse would follow the acting player&apos;s live cardiac timing; this preview uses simulated timing.</p>
        </div>
        <div className="miniature-controls">
          <div className="mini-control" role="group" aria-label="Incentive context">
            <span>INCENTIVES</span>
            <button type="button" className={incentive === 'cooperate' ? 'selected' : ''} onClick={() => setIncentive('cooperate')}>Cooperate</button>
            <button type="button" className={incentive === 'compete' ? 'selected warm' : ''} onClick={() => setIncentive('compete')}>Compete</button>
          </div>
          <div className="mini-control" role="group" aria-label="Cardiac cue design">
            <span>CARDIAC CUE</span>
            <button type="button" className={cueMode === 'edge' ? 'selected' : ''} onClick={() => setCueMode('edge')}>Card edge</button>
            <button type="button" className={cueMode === 'heart' ? 'selected' : ''} onClick={() => setCueMode('heart')}>Heart</button>
          </div>
          <button className="preview-pause" type="button" onClick={() => setPaused((value) => !value)}>{paused ? 'Play sequence' : 'Pause sequence'}</button>
        </div>
      </div>

      <div className="miniature-theatre">
        <Diorama scenario={selected} phase={phase} incentive={incentive} cueMode={cueMode} />
        <ol className="flow-rail" aria-label={`${selected.title} flow`}>
          {selected.phases.map((label, index) => (
            <li key={label} className={index === phase ? 'active' : index < phase ? 'complete' : ''}>
              <button type="button" onClick={() => { setPhase(index); setPaused(true); }} aria-label={`Show phase ${index + 1}: ${label}`}>
                <i>{index + 1}</i><span>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="miniature-grid" aria-label="Choose a card scenario preview">
        {scenarios.map((scenario, index) => (
          <button
            type="button"
            className={`miniature-option${selected.id === scenario.id ? ' selected' : ''}`}
            onClick={() => chooseScenario(scenario.id)}
            aria-pressed={selected.id === scenario.id}
            key={scenario.id}
          >
            <span className="mini-option-heading"><i>{scenario.number}</i><b>{scenario.title}</b><small>{scenario.subtitle}</small></span>
            <Diorama scenario={scenario} phase={(phase + index) % scenario.phases.length} incentive={incentive} cueMode={cueMode} compact />
            <span className="mini-flow">{scenario.phases.map((label, step) => <i className={step === ((phase + index) % scenario.phases.length) ? 'active' : ''} key={label}>{step + 1}</i>)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
