'use client';

import { useEffect, useMemo, useState } from 'react';
import HeartMonitor from './HeartMonitor';
import {
  brierScore,
  concealedRounds,
  informationCards,
  jointAgentMove,
  jointRounds,
  mean,
  probeBpm,
  type CardId,
  type Choice,
  type HeartAccess,
  type Incentive,
} from './gameData';

type ActiveGame = 'menu' | 'joint' | 'concealed';
type GamePhase = 'intro' | 'initial' | 'thinking' | 'advice' | 'prior' | 'probes' | 'final' | 'result' | 'summary';

const accessCopy: Record<HeartAccess, string> = {
  live: 'The trace is contingent on this agent and this trial.',
  replay: 'A plausible recording is shown, but it is not contingent on this trial.',
  hidden: 'The display is present but carries no cardiac information.',
};

function LabMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /></span>;
}

function GameHeader({
  title,
  round,
  total,
  onHome,
  incentive,
  access,
}: {
  title: string;
  round: number;
  total: number;
  onHome: () => void;
  incentive: Incentive;
  access: HeartAccess;
}) {
  return (
    <header className="game-header">
      <button className="brand brand-button" type="button" onClick={onHome}>
        <LabMark />
        <span className="desktop-label">Cardiac Signals Lab</span>
        <span className="mobile-label">Menu</span>
      </button>
      <div className="game-title-block">
        <span>{title}</span>
        <small>{round > 0 ? 'Round ' + round + ' of ' + total : 'Setup'}</small>
      </div>
      <div className="condition-pills" aria-label="Current experimental condition">
        <span className="phone-mode-badge">Phone · touch</span>
        <span className={incentive === 'aligned' ? 'pill aligned' : 'pill opposed'}>
          {incentive === 'aligned' ? 'Aligned' : 'Opposed'}
        </span>
        <span className={'pill access ' + access}>{access}</span>
      </div>
    </header>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="progress-dots" aria-label={'Progress: round ' + Math.min(current + 1, total) + ' of ' + total}>
      {Array.from({ length: total }, (_, index) => (
        <span
          className={index < current ? 'done' : index === current ? 'active' : ''}
          key={index}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ModeSetup({
  incentive,
  access,
  setIncentive,
  setAccess,
}: {
  incentive: Incentive;
  access: HeartAccess;
  setIncentive: (value: Incentive) => void;
  setAccess: (value: HeartAccess) => void;
}) {
  return (
    <div className="mode-setup">
      <fieldset>
        <legend>1 · Incentive relationship</legend>
        <div className="segmented two">
          <button
            type="button"
            className={incentive === 'aligned' ? 'selected' : ''}
            aria-pressed={incentive === 'aligned'}
            onClick={() => setIncentive('aligned')}
          >
            <strong>Cooperate</strong>
            <span>We win together</span>
          </button>
          <button
            type="button"
            className={incentive === 'opposed' ? 'selected warm' : ''}
            aria-pressed={incentive === 'opposed'}
            onClick={() => setIncentive('opposed')}
          >
            <strong>Compete</strong>
            <span>Only one side wins</span>
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>2 · Cardiac information</legend>
        <div className="segmented three">
          {(['live', 'replay', 'hidden'] as HeartAccess[]).map((mode) => (
            <button
              type="button"
              key={mode}
              className={access === mode ? 'selected' : ''}
              aria-pressed={access === mode}
              onClick={() => setAccess(mode)}
            >
              <strong>{mode === 'live' ? 'Live' : mode === 'replay' ? 'Replay' : 'Hidden'}</strong>
              <span>{mode === 'live' ? 'Contingent' : mode === 'replay' ? 'Yoked control' : 'No cue'}</span>
            </button>
          ))}
        </div>
        <p className="setting-explanation">{accessCopy[access]}</p>
      </fieldset>
    </div>
  );
}

function Metric({
  value,
  label,
  note,
  accent = false,
}: {
  value: string;
  label: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? 'metric accent' : 'metric'}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </div>
  );
}

function ResearchSidebar({
  title,
  measures,
  children,
}: {
  title: string;
  measures: string[];
  children?: React.ReactNode;
}) {
  return (
    <aside className="research-sidebar">
      <p className="eyebrow">What is measured?</p>
      <h3>{title}</h3>
      <ol className="measure-list">
        {measures.map((measure, index) => (
          <li key={measure}><span>{String(index + 1).padStart(2, '0')}</span>{measure}</li>
        ))}
      </ol>
      {children}
      <p className="boundary-note"><b>Interpretation boundary.</b> A cardiac display may alter how advice is weighted; it does not identify thoughts, emotions, truth, or a card by itself.</p>
    </aside>
  );
}

type JointResult = {
  initial: Choice;
  final: Choice;
  correct: Choice;
  advice: Choice | 'PASS';
  strategy: 'truth' | 'bluff' | 'withhold';
  confidence: number;
  points: number;
};

function ShapePanel({
  label,
  size,
  selected,
  onSelect,
  disabled,
  target = false,
}: {
  label: string;
  size: number;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  target?: boolean;
}) {
  const content = (
    <>
      <span className="shape-label">{label}</span>
      <span
        className={target ? 'shape-object target' : 'shape-object'}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    </>
  );
  if (!onSelect) return <div className="shape-panel target-panel">{content}</div>;
  return (
    <button
      className={selected ? 'shape-panel selectable selected' : 'shape-panel selectable'}
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      {content}
    </button>
  );
}

function JointGame({ onHome }: { onHome: () => void }) {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [incentive, setIncentive] = useState<Incentive>('aligned');
  const [access, setAccess] = useState<HeartAccess>('live');
  const [roundIndex, setRoundIndex] = useState(0);
  const [initialChoice, setInitialChoice] = useState<Choice | null>(null);
  const [finalChoice, setFinalChoice] = useState<Choice | null>(null);
  const [confidence, setConfidence] = useState(65);
  const [results, setResults] = useState<JointResult[]>([]);

  const round = jointRounds[roundIndex];
  const move = jointAgentMove(roundIndex, round.correct, incentive);

  useEffect(() => {
    if (phase !== 'thinking') return;
    const timer = window.setTimeout(() => setPhase('advice'), 1500);
    return () => window.clearTimeout(timer);
  }, [phase, roundIndex]);

  const start = () => {
    setRoundIndex(0);
    setResults([]);
    setInitialChoice(null);
    setFinalChoice(null);
    setConfidence(65);
    setPhase('initial');
  };

  const submitFinal = () => {
    if (!initialChoice || !finalChoice) return;
    const points = finalChoice === round.correct ? 30 : 0;
    setResults((current) => [...current, {
      initial: initialChoice,
      final: finalChoice,
      correct: round.correct,
      advice: move.advice,
      strategy: move.strategy,
      confidence,
      points,
    }]);
    setPhase('result');
  };

  const nextRound = () => {
    if (roundIndex === jointRounds.length - 1) {
      setPhase('summary');
      return;
    }
    setRoundIndex((index) => index + 1);
    setInitialChoice(null);
    setFinalChoice(null);
    setConfidence(65);
    setPhase('initial');
  };

  const shownBpm = phase === 'thinking' || phase === 'advice' || phase === 'result' ? move.bpm : 74;
  const latest = results[results.length - 1];

  if (phase === 'intro') {
    return (
      <main className="game-shell">
        <GameHeader title="Joint Discrimination" round={0} total={jointRounds.length} onHome={onHome} incentive={incentive} access={access} />
        <div className="intro-layout">
          <section className="intro-copy">
            <p className="eyebrow">Paradigm 01 · Asymmetric evidence</p>
            <h1>Decide under uncertainty. Then decide whom to trust.</h1>
            <p className="lede">You and the simulated agent see the same candidates but different target evidence. Your view is deliberately ambiguous; the agent has the clearer comparison.</p>
            <div className="sequence-strip" aria-label="Task sequence">
              <span><b>1</b> Initial A/B choice</span>
              <i>→</i>
              <span><b>2</b> Agent signal + advice</span>
              <i>→</i>
              <span><b>3</b> Final choice + confidence</span>
            </div>
            <ModeSetup incentive={incentive} access={access} setIncentive={setIncentive} setAccess={setAccess} />
            <button className="primary-action" type="button" onClick={start} data-testid="start-joint">Start four-round game <span>→</span></button>
          </section>
          <aside className="intro-preview">
            <HeartMonitor bpm={incentive === 'opposed' ? 84 : 74} access={access} label="Simulated agent" note="A stylized preview of the available cue." />
            <div className="paper-anchor">
              <span>Published anchor</span>
              <p>Pulford et al. used dyads, two shape options, asymmetric evidence, discussion, individual final choices, confidence ratings, and Deadlock payoffs. This nonverbal demo turns the first suggestion into a discrete A/B/Pass signal and factorially varies incentive alignment.</p>
              <a href="https://doi.org/10.1038/s41598-025-00279-w" target="_blank" rel="noreferrer">Open publication ↗</a>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  if (phase === 'summary') {
    const initialAccuracy = mean(results.map((item) => item.initial === item.correct ? 1 : 0));
    const finalAccuracy = mean(results.map((item) => item.final === item.correct ? 1 : 0));
    const adviceTrials = results.filter((item) => item.advice !== 'PASS');
    const uptake = mean(adviceTrials.map((item) => item.final === item.advice ? 1 : 0));
    const switches = results.filter((item) => item.initial !== item.final).length;
    const points = results.reduce((sum, item) => sum + item.points, 0);
    return (
      <main className="game-shell">
        <GameHeader title="Joint Discrimination" round={jointRounds.length} total={jointRounds.length} onHome={onHome} incentive={incentive} access={access} />
        <section className="summary-view">
          <p className="eyebrow">Session complete</p>
          <h1>Your behavioral outcome profile</h1>
          <p className="lede">The core outcome is not whether a heartbeat “revealed” an answer. It is whether access to a trial-contingent signal changed the accuracy and calibration of your belief revision.</p>
          <div className="metric-grid">
            <Metric value={Math.round(initialAccuracy * 100) + '%'} label="Initial accuracy" note="Before the agent signal" />
            <Metric value={Math.round(finalAccuracy * 100) + '%'} label="Final accuracy" note="Primary decision outcome" accent />
            <Metric value={Math.round(uptake * 100) + '%'} label="Advice uptake" note="Final choices matching advice" />
            <Metric value={String(switches)} label="Choice revisions" note="Initial → final switches" />
            <Metric value={Math.round(mean(results.map((item) => item.confidence))) + '%'} label="Mean confidence" note="Calibration companion" />
            <Metric value={String(points)} label="Your points" note="Incentivized performance" />
          </div>
          <div className="round-ledger">
            {results.map((item, index) => (
              <div key={index}>
                <span>R{index + 1}</span>
                <b>{item.initial} → {item.final}</b>
                <small>Agent: {item.advice} · Truth: {item.correct}</small>
                <em className={item.final === item.correct ? 'correct' : 'incorrect'}>{item.final === item.correct ? 'Correct' : 'Incorrect'}</em>
              </div>
            ))}
          </div>
          <div className="summary-actions">
            <button className="primary-action" type="button" onClick={start}>Run again <span>↻</span></button>
            <button className="secondary-action" type="button" onClick={onHome}>Choose another game</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="game-shell">
      <GameHeader title="Joint Discrimination" round={roundIndex + 1} total={jointRounds.length} onHome={onHome} incentive={incentive} access={access} />
      <div className="play-layout">
        <section className="task-stage">
          <div className="stage-topline">
            <div>
              <p className="eyebrow">Your private view</p>
              <h2>{phase === 'initial' ? 'Which candidate is closer in size?' : phase === 'thinking' ? 'The agent is deciding…' : phase === 'advice' ? 'Review the signal and advice' : 'Outcome revealed'}</h2>
            </div>
            <ProgressDots current={roundIndex} total={jointRounds.length} />
          </div>

          <div className="spatial-stage">
            <div className="shape-row">
              <ShapePanel
                label="A"
                size={round.aSize}
                selected={(phase === 'initial' ? initialChoice : finalChoice) === 'A'}
                disabled={phase === 'thinking' || phase === 'result'}
                onSelect={() => phase === 'initial' ? setInitialChoice('A') : phase === 'advice' ? setFinalChoice('A') : undefined}
              />
              <ShapePanel label="Your target" size={round.receiverTarget} target />
              <ShapePanel
                label="B"
                size={round.bSize}
                selected={(phase === 'initial' ? initialChoice : finalChoice) === 'B'}
                disabled={phase === 'thinking' || phase === 'result'}
                onSelect={() => phase === 'initial' ? setInitialChoice('B') : phase === 'advice' ? setFinalChoice('B') : undefined}
              />
            </div>
            <p className="ambiguity-callout"><i /> Your target is exactly midway. The agent sees a more diagnostic target.</p>
          </div>

          {phase === 'initial' ? (
            <div className="decision-dock">
              <div><span>Stage 1</span><strong>Make an independent choice</strong></div>
              <button className="primary-action small" type="button" disabled={!initialChoice} onClick={() => setPhase('thinking')}>Lock {initialChoice ?? 'choice'} <span>→</span></button>
            </div>
          ) : null}

          {phase === 'thinking' || phase === 'advice' || phase === 'result' ? (
            <HeartMonitor
              bpm={shownBpm}
              access={access}
              label="Agent 07 · cardiac panel"
              note={accessCopy[access]}
            />
          ) : null}

          {phase === 'thinking' ? (
            <div className="agent-thinking" role="status"><i /><span>Agent 07 is comparing private evidence</span><i /><i /></div>
          ) : null}

          {phase === 'advice' ? (
            <div className="advice-dock">
              <div className="agent-advice">
                <span>Agent 07 signals</span>
                <strong>{move.advice === 'PASS' ? 'No recommendation' : 'Choose ' + move.advice}</strong>
                <small>This message and the cardiac cue are separate information channels.</small>
              </div>
              <div className="final-controls">
                <label>
                  Final-choice confidence
                  <span><input type="range" min="50" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /><output>{confidence}%</output></span>
                </label>
                <button className="primary-action small" type="button" disabled={!finalChoice} onClick={submitFinal}>Submit final {finalChoice ?? 'choice'} <span>→</span></button>
              </div>
            </div>
          ) : null}

          {phase === 'result' && latest ? (
            <div className={latest.final === latest.correct ? 'result-dock success' : 'result-dock miss'} role="status">
              <div>
                <span>{latest.final === latest.correct ? 'Correct judgment' : 'Incorrect judgment'}</span>
                <strong>The diagnostic target was closer to {latest.correct}.</strong>
                <p>The agent used a <b>{latest.strategy}</b> strategy. Your initial choice was {latest.initial}, your final choice was {latest.final}, and you reported {latest.confidence}% confidence.</p>
              </div>
              <div className="revealed-evidence">
                <span>Agent&apos;s private target</span>
                <i style={{ width: round.senderTarget, height: round.senderTarget }} />
              </div>
              <button className="primary-action small" type="button" onClick={nextRound}>{roundIndex === jointRounds.length - 1 ? 'View outcomes' : 'Next round'} <span>→</span></button>
            </div>
          ) : null}
        </section>

        <ResearchSidebar
          title="Belief revision under asymmetric information"
          measures={[
            'Initial versus final discrimination accuracy',
            'Switching toward or away from the agent signal',
            'Advice uptake conditional on incentive structure',
            'Confidence and calibration after social evidence',
            'Dyadic payoff under aligned versus opposed goals',
          ]}
        >
          <div className="live-measure">
            <span>Initial choice</span><strong>{initialChoice ?? '—'}</strong>
            <span>Final choice</span><strong>{finalChoice ?? '—'}</strong>
          </div>
        </ResearchSidebar>
      </div>
    </main>
  );
}

type ConcealedResult = {
  prior: CardId;
  final: CardId;
  target: CardId;
  priorConfidence: number;
  finalConfidence: number;
  scoreGain: number;
  points: number;
};

function InformationCard({
  id,
  symbol,
  name,
  color,
  selected,
  active,
  seen,
  disabled,
  onClick,
}: {
  id: CardId;
  symbol: string;
  name: string;
  color: string;
  selected?: boolean;
  active?: boolean;
  seen?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const classes = ['information-card', selected ? 'selected' : '', active ? 'active' : '', seen ? 'seen' : ''].filter(Boolean).join(' ');
  return (
    <button
      className={classes}
      type="button"
      style={{ '--card-color': color } as React.CSSProperties}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="info-card-id">{id}</span>
      <span className="info-card-symbol" aria-hidden="true">{symbol}</span>
      <small>{name}</small>
      {seen ? <i className="seen-dot" aria-label="Probe already shown" /> : null}
    </button>
  );
}

function ConcealedGame({ onHome }: { onHome: () => void }) {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [incentive, setIncentive] = useState<Incentive>('opposed');
  const [access, setAccess] = useState<HeartAccess>('live');
  const [roundIndex, setRoundIndex] = useState(0);
  const [priorChoice, setPriorChoice] = useState<CardId | null>(null);
  const [priorConfidence, setPriorConfidence] = useState(35);
  const [finalChoice, setFinalChoice] = useState<CardId | null>(null);
  const [finalConfidence, setFinalConfidence] = useState(55);
  const [probeIndex, setProbeIndex] = useState(0);
  const [results, setResults] = useState<ConcealedResult[]>([]);

  const round = concealedRounds[roundIndex];
  const probeSequence = useMemo<Array<CardId | 'BUFFER'>>(() => ['BUFFER', ...round.order], [round.order]);
  const currentProbe = probeSequence[probeIndex];
  const currentBpm = currentProbe === 'BUFFER' ? 78 : probeBpm(currentProbe, round.target, round.replayDip, incentive, access);

  const advanceProbe = () => {
    if (probeIndex >= probeSequence.length - 1) {
      setPhase('final');
      return;
    }
    setProbeIndex((index) => index + 1);
  };

  useEffect(() => {
    if (phase !== 'probes') return;
    const timer = window.setTimeout(advanceProbe, 2100);
    return () => window.clearTimeout(timer);
  });

  const start = () => {
    setRoundIndex(0);
    setResults([]);
    setPriorChoice(null);
    setFinalChoice(null);
    setPriorConfidence(35);
    setFinalConfidence(55);
    setProbeIndex(0);
    setPhase('prior');
  };

  const startProbes = () => {
    if (!priorChoice) return;
    setProbeIndex(0);
    setPhase('probes');
  };

  const submitFinal = () => {
    if (!priorChoice || !finalChoice) return;
    const priorScore = brierScore(priorChoice, priorConfidence, round.target);
    const finalScore = brierScore(finalChoice, finalConfidence, round.target);
    setResults((current) => [...current, {
      prior: priorChoice,
      final: finalChoice,
      target: round.target,
      priorConfidence,
      finalConfidence,
      scoreGain: priorScore - finalScore,
      points: finalChoice === round.target ? 40 : 0,
    }]);
    setPhase('result');
  };

  const nextRound = () => {
    if (roundIndex === concealedRounds.length - 1) {
      setPhase('summary');
      return;
    }
    setRoundIndex((index) => index + 1);
    setPriorChoice(null);
    setFinalChoice(null);
    setPriorConfidence(35);
    setFinalConfidence(55);
    setProbeIndex(0);
    setPhase('prior');
  };

  const latest = results[results.length - 1];

  if (phase === 'intro') {
    return (
      <main className="game-shell">
        <GameHeader title="Concealed Information" round={0} total={concealedRounds.length} onHome={onHome} incentive={incentive} access={access} />
        <div className="intro-layout">
          <section className="intro-copy">
            <p className="eyebrow warm">Paradigm 02 · Card recognition</p>
            <h1>Find the card the agent is trying to keep private.</h1>
            <p className="lede">A simulated sender privately recognizes one target. You first state a prior belief, then watch every candidate appear beside the sender&apos;s cardiac display, and finally update your choice.</p>
            <div className="sequence-strip warm" aria-label="Task sequence">
              <span><b>1</b> Prior belief</span>
              <i>→</i>
              <span><b>2</b> Timed card probes</span>
              <i>→</i>
              <span><b>3</b> Posterior belief</span>
            </div>
            <ModeSetup incentive={incentive} access={access} setIncentive={setIncentive} setAccess={setAccess} />
            <button className="primary-action warm" type="button" onClick={start} data-testid="start-concealed">Start three-round game <span>→</span></button>
          </section>
          <aside className="intro-preview">
            <HeartMonitor bpm={incentive === 'opposed' ? 68 : 74} access={access} label="Simulated sender" note="The target response is scripted for demonstration." />
            <div className="paper-anchor warm">
              <span>Published anchor</span>
              <p>Klein Selle et al. had participants select one of six cards, choose conceal or reveal, and then view a buffer, critical item, controls, and catch item. Cardiac deceleration distinguished concealed critical items. This four-alternative dyadic adaptation adds a receiver and proper-score belief updating.</p>
              <a href="https://doi.org/10.1177/0956797619864598" target="_blank" rel="noreferrer">Open publication ↗</a>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  if (phase === 'summary') {
    const accuracy = mean(results.map((item) => item.final === item.target ? 1 : 0));
    const priorAccuracy = mean(results.map((item) => item.prior === item.target ? 1 : 0));
    const scoreGain = mean(results.map((item) => item.scoreGain));
    const revisions = results.filter((item) => item.prior !== item.final).length;
    const points = results.reduce((sum, item) => sum + item.points, 0);
    return (
      <main className="game-shell">
        <GameHeader title="Concealed Information" round={concealedRounds.length} total={concealedRounds.length} onHome={onHome} incentive={incentive} access={access} />
        <section className="summary-view">
          <p className="eyebrow warm">Session complete</p>
          <h1>Your information-gain profile</h1>
          <p className="lede">The primary outcome compares your pre-signal and post-signal probability judgments. Positive proper-score gain means the probe sequence moved your belief closer to the hidden target.</p>
          <div className="metric-grid">
            <Metric value={Math.round(priorAccuracy * 100) + '%'} label="Prior accuracy" note="Before cardiac access" />
            <Metric value={Math.round(accuracy * 100) + '%'} label="Final accuracy" note="Target identification" accent />
            <Metric value={(scoreGain >= 0 ? '+' : '') + scoreGain.toFixed(2)} label="Proper-score gain" note="Primary belief-update outcome" />
            <Metric value={String(revisions)} label="Belief revisions" note="Prior → posterior switches" />
            <Metric value={Math.round(mean(results.map((item) => item.finalConfidence))) + '%'} label="Mean confidence" note="Posterior certainty" />
            <Metric value={String(points)} label="Your points" note="Incentivized identification" />
          </div>
          <div className="round-ledger">
            {results.map((item, index) => (
              <div key={index}>
                <span>R{index + 1}</span>
                <b>{item.prior} → {item.final}</b>
                <small>Hidden target: {item.target} · Gain: {item.scoreGain >= 0 ? '+' : ''}{item.scoreGain.toFixed(2)}</small>
                <em className={item.final === item.target ? 'correct' : 'incorrect'}>{item.final === item.target ? 'Found' : 'Missed'}</em>
              </div>
            ))}
          </div>
          <div className="summary-actions">
            <button className="primary-action warm" type="button" onClick={start}>Run again <span>↻</span></button>
            <button className="secondary-action" type="button" onClick={onHome}>Choose another game</button>
          </div>
        </section>
      </main>
    );
  }

  const seenCards = phase === 'probes'
    ? round.order.slice(0, Math.max(0, probeIndex))
    : phase === 'final' || phase === 'result'
      ? round.order
      : [];
  const activeCard = phase === 'probes' && currentProbe !== 'BUFFER' ? currentProbe : undefined;

  return (
    <main className="game-shell">
      <GameHeader title="Concealed Information" round={roundIndex + 1} total={concealedRounds.length} onHome={onHome} incentive={incentive} access={access} />
      <div className="play-layout">
        <section className="task-stage">
          <div className="stage-topline">
            <div>
              <p className="eyebrow warm">Receiver view · Agent target hidden</p>
              <h2>{phase === 'prior' ? 'Which card is your best guess?' : phase === 'probes' ? currentProbe === 'BUFFER' ? 'Baseline buffer' : 'Probe ' + currentProbe + ' is on screen' : phase === 'final' ? 'Update your belief' : 'Target revealed'}</h2>
            </div>
            <ProgressDots current={roundIndex} total={concealedRounds.length} />
          </div>

          <div className="information-card-grid">
            {informationCards.map((card) => (
              <InformationCard
                key={card.id}
                {...card}
                selected={(phase === 'prior' ? priorChoice : finalChoice) === card.id}
                active={activeCard === card.id}
                seen={seenCards.includes(card.id)}
                disabled={phase === 'probes' || phase === 'result'}
                onClick={() => phase === 'prior' ? setPriorChoice(card.id) : phase === 'final' ? setFinalChoice(card.id) : undefined}
              />
            ))}
          </div>

          {phase === 'prior' ? (
            <div className="belief-dock">
              <label>
                Prior probability for {priorChoice ?? 'your chosen card'}
                <span><input type="range" min="25" max="80" value={priorConfidence} onChange={(event) => setPriorConfidence(Number(event.target.value))} /><output>{priorConfidence}%</output></span>
              </label>
              <button className="primary-action small warm" type="button" disabled={!priorChoice} onClick={startProbes}>Lock prior and begin <span>→</span></button>
            </div>
          ) : null}

          {phase === 'probes' ? (
            <>
              <div className={currentProbe === 'BUFFER' ? 'probe-window buffer' : 'probe-window'}>
                <div className="probe-caption">
                  <span>{currentProbe === 'BUFFER' ? 'Neutral buffer establishes baseline' : 'Candidate ' + currentProbe}</span>
                  <small>{probeIndex + 1} / {probeSequence.length}</small>
                </div>
                {currentProbe === 'BUFFER' ? (
                  <div className="buffer-symbol" aria-label="Neutral buffer stimulus">+</div>
                ) : (
                  <div className="enlarged-probe" style={{ '--card-color': informationCards.find((card) => card.id === currentProbe)?.color } as React.CSSProperties}>
                    <span>{informationCards.find((card) => card.id === currentProbe)?.symbol}</span>
                  </div>
                )}
              </div>
              <HeartMonitor
                bpm={currentBpm}
                access={access}
                label="Agent 12 · cardiac panel"
                note={currentProbe === 'BUFFER' ? 'Use this interval as a visual baseline.' : accessCopy[access]}
              />
              <div className="probe-timeline" aria-hidden="true">
                {probeSequence.map((probe, index) => <i className={index < probeIndex ? 'seen' : index === probeIndex ? 'active' : ''} key={String(probe)} />)}
              </div>
              <button className="skip-probe" type="button" onClick={advanceProbe}>Advance probe</button>
            </>
          ) : null}

          {phase === 'final' ? (
            <div className="posterior-panel">
              <div className="observation-row" aria-label="Observed heart rate by card">
                {informationCards.map((card) => (
                  <span key={card.id}><b>{card.id}</b><small>{access === 'hidden' ? 'hidden' : probeBpm(card.id, round.target, round.replayDip, incentive, access) + ' bpm'}</small></span>
                ))}
              </div>
              <div className="belief-dock">
                <label>
                  Posterior probability for {finalChoice ?? 'your chosen card'}
                  <span><input type="range" min="25" max="97" value={finalConfidence} onChange={(event) => setFinalConfidence(Number(event.target.value))} /><output>{finalConfidence}%</output></span>
                </label>
                <button className="primary-action small warm" type="button" disabled={!finalChoice} onClick={submitFinal}>Submit posterior <span>→</span></button>
              </div>
            </div>
          ) : null}

          {phase === 'result' && latest ? (
            <div className={latest.final === latest.target ? 'result-dock success' : 'result-dock miss'} role="status">
              <div>
                <span>{latest.final === latest.target ? 'Target identified' : 'Target missed'}</span>
                <strong>The agent&apos;s private card was {latest.target}.</strong>
                <p>You moved from {latest.prior} at {latest.priorConfidence}% to {latest.final} at {latest.finalConfidence}%. Proper-score gain: <b>{latest.scoreGain >= 0 ? '+' : ''}{latest.scoreGain.toFixed(2)}</b>.</p>
              </div>
              <div className="target-card-mini">
                <span>{informationCards.find((card) => card.id === latest.target)?.symbol}</span>
                <small>Target {latest.target}</small>
              </div>
              <button className="primary-action small warm" type="button" onClick={nextRound}>{roundIndex === concealedRounds.length - 1 ? 'View outcomes' : 'Next round'} <span>→</span></button>
            </div>
          ) : null}
        </section>

        <ResearchSidebar
          title="Information gain from another person’s cardiac cue"
          measures={[
            'Prior-to-posterior proper-score improvement',
            'Four-alternative target identification accuracy',
            'Direction and magnitude of belief revision',
            'Confidence calibration and overconfidence',
            'Signal benefit under live, replay, and hidden access',
          ]}
        >
          <div className="live-measure">
            <span>Prior belief</span><strong>{priorChoice ?? '—'}</strong>
            <span>Posterior belief</span><strong>{finalChoice ?? '—'}</strong>
          </div>
        </ResearchSidebar>
      </div>
    </main>
  );
}

function Menu({ onOpen }: { onOpen: (game: ActiveGame) => void }) {
  return (
    <main className="menu-shell" id="home">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <span className="brand"><LabMark /><span>Cardiac Signals Lab</span></span>
        <span className="demo-badge"><i /> Interactive research demo</span>
        <span className="phone-mode-badge"><i /> Phone mode · touch optimized</span>
      </header>

      <section className="menu-content" aria-labelledby="menu-title">
        <p className="eyebrow">Mixed-reality task preview</p>
        <h1 id="menu-title">Can another person&apos;s heartbeat change your decision?</h1>
        <p className="lede">Choose a paradigm. Each playable simulation pairs you with a scripted agent and makes the agent&apos;s cardiac signal available as an experimental cue—not as a lie detector.</p>

        <div className="game-grid" aria-label="Choose a game">
          <button className="game-card cyan" type="button" onClick={() => onOpen('joint')} data-testid="open-joint">
            <span className="card-index">01</span>
            <div className="card-visual" aria-hidden="true"><span className="floating-card back" /><span className="floating-card front"><i /></span></div>
            <span className="card-copy">
              <span className="card-label">Asymmetric evidence</span>
              <strong>Joint Discrimination</strong>
              <span>Judge which shape matches a target while a better-informed agent can advise, withhold, or mislead.</span>
              <b className="launch-link">Enter simulation <i aria-hidden="true">↗</i></b>
            </span>
          </button>
          <button className="game-card coral" type="button" onClick={() => onOpen('concealed')} data-testid="open-concealed">
            <span className="card-index">02</span>
            <div className="card-visual" aria-hidden="true"><span className="floating-card back" /><span className="floating-card front"><i /></span></div>
            <span className="card-copy">
              <span className="card-label">Card recognition</span>
              <strong>Concealed Information</strong>
              <span>Watch a sequence of card probes and decide which one the agent privately selected.</span>
              <b className="launch-link">Enter simulation <i aria-hidden="true">↗</i></b>
            </span>
          </button>
        </div>

        <section className="design-matrix" aria-labelledby="matrix-title">
          <div>
            <p className="eyebrow">Shared experimental spine</p>
            <h2 id="matrix-title">Two games, the same causal question</h2>
          </div>
          <div className="matrix-row">
            <span><b>Incentives</b>Aligned ↔ Opposed</span>
            <span><b>Cardiac access</b>Live ↔ Replay ↔ Hidden</span>
            <span><b>Behavior</b>Pre-signal ↔ Post-signal belief</span>
          </div>
        </section>
      </section>

      <footer className="menu-footer">
        <span>2D preview of spatial card panels · simulated partner · no data recorded <b className="phone-footer-note">· phone mode activates automatically</b></span>
        <span className="source-links">
          <a href="https://doi.org/10.1038/s41598-025-00279-w" target="_blank" rel="noreferrer">Pulford 2025</a>
          <a href="https://doi.org/10.1177/0956797619864598" target="_blank" rel="noreferrer">Klein Selle 2019</a>
          <a href="https://doi.org/10.1111/psyp.12239" target="_blank" rel="noreferrer">Meijer 2014</a>
        </span>
      </footer>
    </main>
  );
}

export default function Home() {
  const [activeGame, setActiveGame] = useState<ActiveGame>('menu');

  const navigate = (game: ActiveGame) => {
    setActiveGame(game);
    const hash = game === 'menu' ? '#home' : game === 'joint' ? '#joint-discrimination' : '#concealed-information';
    window.history.replaceState(null, '', hash);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (activeGame === 'joint') return <JointGame onHome={() => navigate('menu')} />;
  if (activeGame === 'concealed') return <ConcealedGame onHome={() => navigate('menu')} />;
  return <Menu onOpen={navigate} />;
}
