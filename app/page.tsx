'use client';

import { useEffect, useMemo, useState } from 'react';
import ExperimentMiniatures from './ExperimentMiniatures';
import HeartMonitor, { cardiacCueStrength, type CardiacDisplayMode } from './HeartMonitor';
import {
  concealedRounds,
  informationCards,
  jointAgentMove,
  jointRounds,
  probeBpm,
  type CardId,
  type Choice,
  type HeartAccess,
  type Incentive,
} from './gameData';

type ActiveGame = 'menu' | 'joint' | 'concealed';
type GamePhase = 'intro' | 'initial' | 'thinking' | 'advice' | 'prior' | 'probes' | 'final' | 'result' | 'summary';

const accessCopy: Record<HeartAccess, string> = {
  live: 'The stylized cue is contingent on the other player and this trial.',
  replay: 'A plausible stylized cue is shown, but it is not contingent on this trial.',
  hidden: 'The cue location is present but carries no cardiac information.',
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
  const opposedLabel = title === 'Joint Discrimination' ? 'Mixed motive' : 'Competitive';
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
          {incentive === 'aligned' ? 'Cooperative' : opposedLabel}
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
  game,
}: {
  incentive: Incentive;
  access: HeartAccess;
  setIncentive: (value: Incentive) => void;
  setAccess: (value: HeartAccess) => void;
  game: 'joint' | 'concealed';
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
            <span>{game === 'joint' ? 'Shared decision reward' : 'Both score if you identify it'}</span>
          </button>
          <button
            type="button"
            className={incentive === 'opposed' ? 'selected warm' : ''}
            aria-pressed={incentive === 'opposed'}
            onClick={() => setIncentive('opposed')}
          >
            <strong>{game === 'joint' ? 'Mixed motive' : 'Compete'}</strong>
            <span>{game === 'joint' ? 'Rewards can diverge' : 'You identify; they conceal'}</span>
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

function ParticipantSidebar({
  you,
  other,
  receive,
  privateItems,
  incentive,
  game,
}: {
  you: string;
  other: string;
  receive: string;
  privateItems: string[];
  incentive: Incentive;
  game: 'joint' | 'concealed';
}) {
  const reward = game === 'joint'
    ? incentive === 'aligned'
      ? 'You are rewarded for reaching the same correct answer.'
      : 'The payoff is mixed-motive: agreement can help both players, but being the only correct player pays most.'
    : incentive === 'aligned'
      ? 'Both players score if you identify the private card.'
      : 'You score if you identify it; Player 1 scores if you miss.';
  return (
    <aside className="research-sidebar participant-sidebar">
      <p className="eyebrow">Your role in this trial</p>
      <h3>{you}</h3>
      <dl className="role-facts">
        <div><dt>Other player</dt><dd>{other}</dd></div>
        <div><dt>You receive</dt><dd>{receive}</dd></div>
        <div><dt>Reward rule</dt><dd>{reward}</dd></div>
      </dl>
      <div className="privacy-card">
        <span>Private · not shown to the other player</span>
        <ul>
        {privateItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
        </ul>
      </div>
      <p className="boundary-note"><b>Important.</b> The stylized cardiac cue is not a literal readout of confidence, truth, recognition, or emotion.</p>
    </aside>
  );
}

type JointResult = {
  initial: Choice;
  final: Choice;
  correct: Choice;
  advice: Choice | 'PASS';
  strategy: 'truth' | 'bluff' | 'withhold';
  points: number;
};

function ShapePanel({
  label,
  size,
  selected,
  onSelect,
  disabled,
  target = false,
  cueStrength = 0,
}: {
  label: string;
  size: number;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  target?: boolean;
  cueStrength?: number;
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
      className={`${selected ? 'shape-panel selectable selected' : 'shape-panel selectable'}${cueStrength ? ' cardiac-edge-glow' : ''}`}
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      style={{ '--cue-strength': `${cueStrength}%`, '--cue-alpha': `${0.2 + cueStrength / 140}` } as React.CSSProperties}
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
  const [cueMode, setCueMode] = useState<CardiacDisplayMode>('heart');
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
    setPhase('initial');
  };

  const shownBpm = phase === 'thinking' || phase === 'advice' || phase === 'result' ? move.bpm : 74;
  const jointCueStrength = cardiacCueStrength(shownBpm, access, 'decision');
  const displayedChoice = phase === 'initial'
    ? initialChoice
    : phase === 'advice'
      ? finalChoice
      : phase === 'result'
        ? finalChoice
        : initialChoice;

  if (phase === 'intro') {
    return (
      <main className="game-shell">
        <GameHeader title="Joint Discrimination" round={0} total={jointRounds.length} onHome={onHome} incentive={incentive} access={access} />
        <div className="intro-layout">
          <section className="intro-copy">
            <p className="eyebrow">Paradigm 01 · Asymmetric evidence</p>
            <h1>You are Player B. Make two private judgments.</h1>
            <p className="lede">You and Player A see the same candidates but different target cards. Your target is deliberately ambiguous; Player A sees a clearer target and later sends one discrete A, B, or Pass selection.</p>
            <div className="sequence-strip" aria-label="Task sequence">
              <span><b>1</b> Private initial choice</span>
              <i>→</i>
              <span><b>2</b> Player A selection + cardiac cue</span>
              <i>→</i>
              <span><b>3</b> Private final response</span>
            </div>
            <ModeSetup incentive={incentive} access={access} setIncentive={setIncentive} setAccess={setAccess} game="joint" />
            <p className="participant-clarifier"><b>No confidence report.</b> The only public information is Player A&apos;s selected card and, when enabled, their cardiac-state cue.</p>
            <button className="primary-action" type="button" onClick={start} data-testid="start-joint">Start four-round game <span>→</span></button>
          </section>
          <aside className="intro-preview">
            <HeartMonitor bpm={incentive === 'opposed' ? 84 : 74} access={access} label="Player A · simulated cardiac-state cue" note="Choose an animated heart or a glow that will appear on Player A’s selected card." displayMode={cueMode} onDisplayModeChange={setCueMode} cueMeaning="decision" />
            <div className="paper-anchor">
              <span>Published anchor</span>
              <p>In Pulford et al., dyads discussed A/B face to face and later recorded private judgments. This proposed nonverbal extension replaces discussion with an A/B/Pass card, adds a private pre-signal choice, and renders Player A&apos;s cardiac activity as a public heart or card-edge cue.</p>
              <a href="https://doi.org/10.1038/s41598-025-00279-w" target="_blank" rel="noreferrer">Open publication ↗</a>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  if (phase === 'summary') {
    return (
      <main className="game-shell">
        <GameHeader title="Joint Discrimination" round={jointRounds.length} total={jointRounds.length} onHome={onHome} incentive={incentive} access={access} />
        <section className="summary-view">
          <p className="eyebrow">Session complete</p>
          <h1>Your responses have been recorded.</h1>
          <p className="lede">You completed {results.length} rounds. Trial accuracy, Player A&apos;s private evidence, strategy, and payoff are withheld during the session so they cannot shape later decisions.</p>
          <div className="completion-card">
            <span>Participant view</span>
            <strong>No trial-by-trial truth feedback</strong>
            <p>In a real study, any performance summary or explanation of the simulated partner would appear only in the debriefing.</p>
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
              <p className="eyebrow">You are Player B · your target card is private</p>
              <h2>{phase === 'initial' ? 'Which candidate is closer in size?' : phase === 'thinking' ? 'Player A is viewing their target' : phase === 'advice' ? 'Review Player A’s selection' : 'Response recorded'}</h2>
            </div>
            <ProgressDots current={roundIndex} total={jointRounds.length} />
          </div>

          <div className="spatial-stage">
            <div className="shape-row">
              <ShapePanel
                label="A"
                size={round.aSize}
                selected={displayedChoice === 'A'}
                disabled={phase === 'thinking' || phase === 'result'}
                cueStrength={cueMode === 'glow' && (phase === 'advice' || phase === 'result') && move.advice === 'A' ? jointCueStrength : 0}
                onSelect={() => phase === 'initial' ? setInitialChoice('A') : phase === 'advice' ? setFinalChoice('A') : undefined}
              />
              <ShapePanel label="Your target" size={round.receiverTarget} target />
              <ShapePanel
                label="B"
                size={round.bSize}
                selected={displayedChoice === 'B'}
                disabled={phase === 'thinking' || phase === 'result'}
                cueStrength={cueMode === 'glow' && (phase === 'advice' || phase === 'result') && move.advice === 'B' ? jointCueStrength : 0}
                onSelect={() => phase === 'initial' ? setInitialChoice('B') : phase === 'advice' ? setFinalChoice('B') : undefined}
              />
            </div>
            <p className="ambiguity-callout"><i /> Your target is exactly midway. Player A sees a more diagnostic target.</p>
          </div>

          {phase === 'initial' ? (
            <div className="decision-dock">
              <div><span>Stage 1 · Private</span><strong>Choose A or B</strong></div>
              <button className="primary-action small" type="button" disabled={!initialChoice} onClick={() => setPhase('thinking')}>Lock {initialChoice ?? 'choice'} <span>→</span></button>
            </div>
          ) : null}

          {phase === 'thinking' || phase === 'advice' || phase === 'result' ? (
            <HeartMonitor
              bpm={shownBpm}
              access={access}
              label="Player A · public cardiac-state cue"
              note={accessCopy[access]}
              displayMode={cueMode}
              onDisplayModeChange={setCueMode}
              cueMeaning="decision"
            />
          ) : null}

          {phase === 'thinking' ? (
            <div className="agent-thinking" role="status"><i /><span>Player A is comparing their private target</span><i /><i /></div>
          ) : null}

          {phase === 'advice' ? (
            <div className="advice-dock">
              <div className="agent-advice">
                <span>Player A selected</span>
                <strong>{move.advice === 'PASS' ? 'Pass · no selection' : move.advice}</strong>
                <small>The selected card and its stylized cardiac-state cue are visible. Now choose your own final answer.</small>
              </div>
              <div className="final-controls">
                <button className="primary-action small" type="button" disabled={!finalChoice} onClick={submitFinal}>Submit final {finalChoice ?? 'choice'} <span>→</span></button>
              </div>
            </div>
          ) : null}

          {phase === 'result' ? (
            <div className="result-dock recorded" role="status">
              <div>
                <span>Response recorded</span>
                <strong>Your private final answer is locked.</strong>
                <p>You will not see the correct answer, Player A&apos;s private target, or their strategy during the session.</p>
              </div>
              <button className="primary-action small" type="button" onClick={nextRound}>{roundIndex === jointRounds.length - 1 ? 'Finish session' : 'Next round'} <span>→</span></button>
            </div>
          ) : null}
        </section>

        <ParticipantSidebar
          you="Player B · less-informed judge"
          other="Player A sees a more diagnostic target card."
          receive={`An A, B, or Pass selection${access === 'hidden' ? '; the cardiac cue is hidden' : ' plus a heart or card-edge cardiac-state cue'}.`}
          privateItems={['Your first choice', 'Your final choice', 'Your response times']}
          incentive={incentive}
          game="joint"
        />
      </div>
    </main>
  );
}

type ConcealedResult = {
  prior: CardId;
  final: CardId;
  target: CardId;
  points: number;
};

type InformationCardData = (typeof informationCards)[number];

function PlayingCardFace({ card, compact = false }: { card: InformationCardData; compact?: boolean }) {
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <span className={`playing-card-face ${red ? 'red-suit' : 'black-suit'}${compact ? ' compact' : ''}`} aria-hidden="true">
      <span className="playing-card-corner top"><b>{card.rank}</b><i>{card.suit}</i></span>
      <span className="playing-card-center"><b>{card.rank}</b><i>{card.suit}</i></span>
      <span className="playing-card-corner bottom"><b>{card.rank}</b><i>{card.suit}</i></span>
    </span>
  );
}

function InformationCard({
  id,
  rank,
  suit,
  name,
  color,
  selected,
  active,
  seen,
  disabled,
  cueStrength = 0,
  onClick,
}: {
  id: CardId;
  rank: string;
  suit: string;
  name: string;
  color: string;
  selected?: boolean;
  active?: boolean;
  seen?: boolean;
  disabled?: boolean;
  cueStrength?: number;
  onClick?: () => void;
}) {
  const classes = ['information-card', selected ? 'selected' : '', active ? 'active' : '', seen ? 'seen' : '', cueStrength ? 'cardiac-edge-glow' : ''].filter(Boolean).join(' ');
  return (
    <button
      className={classes}
      type="button"
      style={{ '--card-color': color, '--cue-strength': `${cueStrength}%`, '--cue-alpha': `${0.2 + cueStrength / 140}` } as React.CSSProperties}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Candidate ${id}, ${name}`}
    >
      <span className="info-card-id">Candidate {id}</span>
      <PlayingCardFace card={{ id, rank, suit, name, color } as InformationCardData} />
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
  const [finalChoice, setFinalChoice] = useState<CardId | null>(null);
  const [cueMode, setCueMode] = useState<CardiacDisplayMode>('heart');
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
    setResults((current) => [...current, {
      prior: priorChoice,
      final: finalChoice,
      target: round.target,
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
    setProbeIndex(0);
    setPhase('prior');
  };

  if (phase === 'intro') {
    return (
      <main className="game-shell">
        <GameHeader title="Concealed Information" round={0} total={concealedRounds.length} onHome={onHome} incentive={incentive} access={access} />
        <div className="intro-layout">
          <section className="intro-copy">
            <p className="eyebrow warm">Paradigm 02 · Card recognition</p>
            <h1>You are the observer. Identify Player 1&apos;s private card.</h1>
            <p className="lede">Player 1 has privately selected one card. First make a private guess, then watch each candidate with Player 1&apos;s stylized heart or card-edge cue, and finally submit an updated guess.</p>
            <div className="sequence-strip warm" aria-label="Task sequence">
              <span><b>1</b> Prior belief</span>
              <i>→</i>
              <span><b>2</b> Timed card probes</span>
              <i>→</i>
              <span><b>3</b> Posterior belief</span>
            </div>
            <ModeSetup incentive={incentive} access={access} setIncentive={setIncentive} setAccess={setAccess} game="concealed" />
            <p className="participant-clarifier"><b>No confidence report.</b> Your initial and final card choices remain private. Only the cardiac-state cue is publicly visible.</p>
            <button className="primary-action warm" type="button" onClick={start} data-testid="start-concealed">Start three-round game <span>→</span></button>
          </section>
          <aside className="intro-preview">
            <HeartMonitor bpm={incentive === 'opposed' ? 68 : 74} access={access} label="Player 1 · simulated cardiac cue" note="Choose an animated heart or a glow that will appear on each card as it is probed." displayMode={cueMode} onDisplayModeChange={setCueMode} cueMeaning="recognition" />
            <div className="paper-anchor warm">
              <span>Published anchor</span>
              <p>Klein Selle et al. studied one instrumented participant—there was no observer guessing the card. Participants selected from six cards, chose conceal or reveal, and then saw a buffer, critical item, controls, and catch item. This proposed dyadic extension adds you as the observer, displays cardiac activity, and measures pre/post belief updating.</p>
              <a href="https://doi.org/10.1177/0956797619864598" target="_blank" rel="noreferrer">Open publication ↗</a>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  if (phase === 'summary') {
    return (
      <main className="game-shell">
        <GameHeader title="Concealed Information" round={concealedRounds.length} total={concealedRounds.length} onHome={onHome} incentive={incentive} access={access} />
        <section className="summary-view">
          <p className="eyebrow warm">Session complete</p>
          <h1>Your responses have been recorded.</h1>
          <p className="lede">You completed {results.length} rounds. The private card and trial accuracy are withheld so feedback cannot train you to read the scripted cardiac pattern across later trials.</p>
          <div className="completion-card warm">
            <span>Participant view</span>
            <strong>No target reveal during the task</strong>
            <p>Any explanation of the simulated signal, concealed card, or scoring would be reserved for the debriefing.</p>
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
  const probeCard = currentProbe === 'BUFFER' ? undefined : informationCards.find((card) => card.id === currentProbe);

  return (
    <main className="game-shell">
      <GameHeader title="Concealed Information" round={roundIndex + 1} total={concealedRounds.length} onHome={onHome} incentive={incentive} access={access} />
      <div className="play-layout">
        <section className="task-stage">
          <div className="stage-topline">
            <div>
              <p className="eyebrow warm">You are the observer · Player 1&apos;s card is hidden</p>
              <h2>{phase === 'prior' ? 'Which card is your best guess?' : phase === 'probes' ? currentProbe === 'BUFFER' ? 'Baseline buffer' : `Probe ${currentProbe}: ${probeCard?.name}` : phase === 'final' ? 'Update your private guess' : 'Response recorded'}</h2>
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
                cueStrength={cueMode === 'glow' && activeCard === card.id ? cardiacCueStrength(currentBpm, access, 'recognition') : 0}
                onClick={() => phase === 'prior' ? setPriorChoice(card.id) : phase === 'final' ? setFinalChoice(card.id) : undefined}
              />
            ))}
          </div>

          {phase === 'prior' ? (
            <div className="belief-dock">
              <div><span>Stage 1 · Private</span><strong>Select your initial candidate</strong></div>
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
                  probeCard ? <div className="enlarged-probe"><PlayingCardFace card={probeCard} /></div> : null
                )}
              </div>
              <HeartMonitor
                bpm={currentBpm}
                access={access}
                label="Player 1 · public cardiac-change cue"
                note={currentProbe === 'BUFFER' ? 'Use this interval as a visual baseline.' : accessCopy[access]}
                displayMode={cueMode}
                onDisplayModeChange={setCueMode}
                cueMeaning="recognition"
              />
              <div className="probe-timeline" aria-hidden="true">
                {probeSequence.map((probe, index) => <i className={index < probeIndex ? 'seen' : index === probeIndex ? 'active' : ''} key={String(probe)} />)}
              </div>
              <button className="skip-probe" type="button" onClick={advanceProbe}>Advance probe</button>
            </>
          ) : null}

          {phase === 'final' ? (
            <div className="posterior-panel">
              <div className="observation-row cue-memory" aria-label="Remembered stylized cardiac cue by card">
                {informationCards.map((card) => {
                  const strength = cardiacCueStrength(probeBpm(card.id, round.target, round.replayDip, incentive, access), access, 'recognition');
                  const band = strength < 40 ? 'subtle' : strength < 70 ? 'moderate' : 'strong';
                  return (
                    <span key={card.id} style={{ '--cue-strength': `${strength}%`, '--cue-alpha': `${0.2 + strength / 140}` } as React.CSSProperties}>
                      <b>{card.id}</b><i aria-hidden="true" /><small>{access === 'hidden' ? 'hidden' : `${band} cue`}</small>
                    </span>
                  );
                })}
              </div>
              <div className="belief-dock">
                <div><span>Stage 3 · Private</span><strong>Select your final candidate</strong></div>
                <button className="primary-action small warm" type="button" disabled={!finalChoice} onClick={submitFinal}>Submit final choice <span>→</span></button>
              </div>
            </div>
          ) : null}

          {phase === 'result' ? (
            <div className="result-dock recorded" role="status">
              <div>
                <span>Response recorded</span>
                <strong>Your final guess is locked.</strong>
                <p>Player 1&apos;s card and your accuracy will not be shown during the session.</p>
              </div>
              <button className="primary-action small warm" type="button" onClick={nextRound}>{roundIndex === concealedRounds.length - 1 ? 'Finish session' : 'Next round'} <span>→</span></button>
            </div>
          ) : null}
        </section>

        <ParticipantSidebar
          you="Observer · identify the private card"
          other="Player 1 selected one of the four cards before the trial."
          receive={access === 'hidden' ? 'The four timed card probes; the cardiac cue is hidden.' : 'The four timed card probes plus a heart or card-edge cardiac-change cue.'}
          privateItems={['Your initial card guess', 'Your final card guess', 'Your response times']}
          incentive={incentive}
          game="concealed"
        />
      </div>
    </main>
  );
}

function Menu() {
  return (
    <main className="menu-shell" id="home">
      <header className="topbar">
        <span className="brand"><LabMark /><span>Cardiac Signals Lab</span></span>
      </header>

      <section className="menu-content" aria-labelledby="menu-title">
        <h1 id="menu-title" className="sr-only">Card game scenarios</h1>

        <ExperimentMiniatures />
      </section>
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
  return <Menu />;
}
