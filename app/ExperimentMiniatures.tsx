'use client';

import { useEffect, useMemo, useState } from 'react';
import ThreeTableScene, { ThreeIncentiveMode, ThreeScenarioId } from './ThreeTableScene';

type Activity = { far: string; near: string; farSpeech: string; nearSpeech: string };
type Scenario = {
  id: ThreeScenarioId; number: string; title: string; oneLine: string; goal: string;
  steps: [string, string, string]; cooperate: string; compete: string; measured: string;
  phases: string[]; activities: Activity[];
};

const scenarios: Scenario[] = [
  {
    id: 'signal', number: '01', title: 'Hidden Target',
    oneLine: 'Player A knows a hidden target. Player B must identify it from a card signal and an optional cardiac cue.',
    goal: 'Choose the same target card without speaking.',
    steps: [
      'Player A privately sees which card is the target.',
      'Player A places one signal card. Its red edge pulses with Player A’s heartbeat.',
      'Player B chooses a target card. Both cards are revealed and points are awarded.',
    ],
    cooperate: 'Both players win when Player B finds the correct target.',
    compete: 'Player A wins by misleading Player B; Player B wins by finding the target.',
    measured: 'Target accuracy, decision time, cue use, payoff, and cardiac coupling.',
    phases: ['See target', 'Send signal', 'Heartbeat visible', 'Choose target', 'Reveal result'],
    activities: [
      { far: 'Sees the private SUN target', near: 'Waits without target information', farSpeech: 'I can see the target: SUN.', nearSpeech: 'I do not know the target yet.' },
      { far: 'Places the SUN signal card', near: 'Watches the shared table', farSpeech: 'I will place this signal.', nearSpeech: 'What is Player A showing me?' },
      { far: 'Heartbeat drives the card edge', near: 'Can use or ignore the pulse', farSpeech: 'My card edge follows my heartbeat.', nearSpeech: 'The red pulse is extra information.' },
      { far: 'Keeps the target private', near: 'Chooses the SUN card', farSpeech: 'My target stays hidden.', nearSpeech: 'I choose SUN.' },
      { far: 'Reveals the target', near: 'Sees whether the choice matched', farSpeech: 'The target was SUN.', nearSpeech: 'Our cards match.' },
    ],
  },
  {
    id: 'dilemma', number: '02', title: 'Share / Keep',
    oneLine: 'Both players privately choose Share or Keep, then reveal their cards at the same time.',
    goal: 'Choose whether to cooperate with or take advantage of the other player.',
    steps: [
      'Each player privately chooses a Share or Keep card.',
      'Both cards lock in. The partner’s card edge pulses with their heartbeat before reveal.',
      'The cards turn over together and the payoff depends on both choices.',
    ],
    cooperate: 'The payoff table rewards both players most when both choose Share.',
    compete: 'A player can gain an individual advantage by choosing Keep when the partner chooses Share.',
    measured: 'Share choices, reciprocity, switching, response time, payoff, and cardiac coupling.',
    phases: ['Choose privately', 'Lock both cards', 'Heartbeat visible', 'Reveal together', 'Receive payoff'],
    activities: [
      { far: 'Chooses Share or Keep', near: 'Chooses Share or Keep', farSpeech: 'I choose in private.', nearSpeech: 'So do I.' },
      { far: 'Locks the card face-down', near: 'Locks the card face-down', farSpeech: 'My choice is locked.', nearSpeech: 'My choice cannot change now.' },
      { far: 'Heartbeat drives the card edge', near: 'Sees Player A’s red pulse', farSpeech: 'My heartbeat is visible.', nearSpeech: 'Does the pulse change my prediction?' },
      { far: 'Reveals the chosen card', near: 'Reveals at the same time', farSpeech: 'Reveal.', nearSpeech: 'Reveal.' },
      { far: 'Receives the round payoff', near: 'Receives the round payoff', farSpeech: 'Our choices set both payoffs.', nearSpeech: 'Next round, I can adapt.' },
    ],
  },
  {
    id: 'concealed', number: '03', title: 'Concealed Card',
    oneLine: 'Player A recognizes one secret card among several candidates. Player B tries to detect which one it is.',
    goal: 'Identify the card that Player A knows but is trying not to reveal.',
    steps: [
      'Player A memorizes one private card: here, the four of diamonds.',
      'Candidate cards appear one at a time. The red edge shows Player A’s heartbeat during each card.',
      'Player B selects the card they think Player A recognized.',
    ],
    cooperate: 'Both players win when Player B correctly finds the remembered card.',
    compete: 'Player A wins by concealing the card; Player B wins by detecting it.',
    measured: 'Detection accuracy, probe-by-probe cardiac change, response time, and concealment success.',
    phases: ['Memorize card', 'View candidates', 'Heartbeat visible', 'Select candidate', 'Record accuracy'],
    activities: [
      { far: 'Memorizes the 4♦', near: 'Does not see the private card', farSpeech: 'I must remember the 4♦.', nearSpeech: 'I do not know which card it is.' },
      { far: 'Views each candidate silently', near: 'Inspects the same candidates', farSpeech: 'I will try not to react.', nearSpeech: 'I am watching each presentation.' },
      { far: 'Heartbeat drives each card edge', near: 'Looks for a card-specific change', farSpeech: 'The 4♦ is familiar to me.', nearSpeech: 'Did the pulse change on that card?' },
      { far: 'Makes no explicit response', near: 'Selects the 4♦', farSpeech: 'I give no verbal clue.', nearSpeech: 'I select the 4♦.' },
      { far: 'Reveals the memorized card', near: 'Receives accuracy feedback', farSpeech: 'The secret card was 4♦.', nearSpeech: 'My detection is recorded.' },
    ],
  },
  {
    id: 'ultimatum', number: '04', title: 'Offer / Response',
    oneLine: 'Player A divides ten tokens. Player B accepts the split or rejects it for both players.',
    goal: 'Make and respond to a division of ten tokens.',
    steps: [
      'Player A privately chooses how to divide ten tokens.',
      'The offer card is placed on the table. Its red edge pulses with Player A’s heartbeat.',
      'Player B plays Accept or Reject. Accept implements the split; Reject gives both players zero.',
    ],
    cooperate: 'Both players are rewarded for accepting a reasonably balanced division.',
    compete: 'Player A tries to keep more; Player B can punish an unfair offer by rejecting it.',
    measured: 'Offer size, acceptance, costly rejection, response time, and cardiac coupling.',
    phases: ['Prepare offer', 'Place offer', 'Heartbeat visible', 'Accept or reject', 'Pay tokens'],
    activities: [
      { far: 'Chooses a 7 / 3 split', near: 'Waits for the offer', farSpeech: 'I will divide ten tokens.', nearSpeech: 'I cannot see the offer yet.' },
      { far: 'Places the 7 / 3 card', near: 'Reads the proposed split', farSpeech: 'My offer is seven for you, three for me.', nearSpeech: 'Is this split acceptable?' },
      { far: 'Heartbeat drives the offer edge', near: 'Can use or ignore the pulse', farSpeech: 'My heartbeat is visible now.', nearSpeech: 'The pulse may reveal arousal, not intent.' },
      { far: 'Waits for the response', near: 'Places Accept', farSpeech: 'The decision belongs to Player B.', nearSpeech: 'I choose Accept.' },
      { far: 'Receives three tokens', near: 'Receives seven tokens', farSpeech: 'I receive three.', nearSpeech: 'I receive seven.' },
    ],
  },
];

function SceneFrame({ scenario, phase, incentive, compact = false }: { scenario: Scenario; phase: number; incentive: ThreeIncentiveMode; compact?: boolean }) {
  const activity = scenario.activities[phase];
  return (
    <div className={`webgl-scene-frame${compact ? ' compact' : ''}`} aria-label={`${scenario.title}, phase ${phase + 1}: ${scenario.phases[phase]}`}>
      <ThreeTableScene scenarioId={scenario.id} phase={phase} incentive={incentive} cueMode="edge" compact={compact} />
      <span className="webgl-badge">LIVE 3D · WEBGL</span>
      {!compact ? (
        <>
          <div className="speech-bubble player-a"><span>PLAYER A</span>{activity.farSpeech}</div>
          <div className="speech-bubble player-b"><span>PLAYER B · YOU</span>{activity.nearSpeech}</div>
          <div className="player-activity player-a"><span>PLAYER A ACTIVITY</span><strong>{activity.far}</strong></div>
          <div className="player-activity player-b"><span>PLAYER B ACTIVITY</span><strong>{activity.near}</strong></div>
        </>
      ) : null}
    </div>
  );
}

export default function ExperimentMiniatures() {
  const [selectedId, setSelectedId] = useState<ThreeScenarioId>('signal');
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [incentive, setIncentive] = useState<ThreeIncentiveMode>('cooperate');
  const selected = useMemo(() => scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0], [selectedId]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setPhase((current) => (current + 1) % selected.phases.length), 2500);
    return () => window.clearInterval(timer);
  }, [paused, selected]);

  const chooseScenario = (id: ThreeScenarioId) => {
    setSelectedId(id);
    setPhase(0);
    setPaused(false);
  };

  return (
    <section className="miniature-lab three-lab" aria-labelledby="miniature-title">
      <div className="miniature-heading">
        <div>
          <p className="eyebrow">Animated mixed-reality study table</p>
          <h2 id="miniature-title">Two players. Real 3D cards. One visible heartbeat cue.</h2>
          <p>Every preview is rendered as an interactive WebGL scene with 3D participants, furniture, cards, lighting, and shadows. The red glow around Player A&apos;s card is synchronized to simulated heartbeat timing.</p>
        </div>
        <div className="miniature-controls compact-controls">
          <div className="mini-control" role="group" aria-label="Incentive context">
            <span>ROUND INCENTIVE</span>
            <button type="button" className={incentive === 'cooperate' ? 'selected' : ''} onClick={() => setIncentive('cooperate')}>Cooperate</button>
            <button type="button" className={incentive === 'compete' ? 'selected warm' : ''} onClick={() => setIncentive('compete')}>Compete</button>
          </div>
          <div className="fixed-cue-label"><i /> Card edge = Player A&apos;s heartbeat</div>
          <button className="preview-pause" type="button" onClick={() => setPaused((value) => !value)}>{paused ? 'Play sequence' : 'Pause sequence'}</button>
        </div>
      </div>

      <div className="three-theatre">
        <div className="three-stage-column">
          <SceneFrame scenario={selected} phase={phase} incentive={incentive} />
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

        <aside className="plain-instructions" aria-live="polite">
          <p className="instruction-kicker">PLAIN-LANGUAGE INSTRUCTIONS · {selected.number}</p>
          <h3>{selected.title}</h3>
          <strong className="instruction-goal">Goal: {selected.goal}</strong>
          <ol>{selected.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <div className="incentive-explanation">
            <p className={incentive === 'cooperate' ? 'active' : ''}><b>Cooperating</b>{selected.cooperate}</p>
            <p className={incentive === 'compete' ? 'active compete' : ''}><b>Competing</b>{selected.compete}</p>
          </div>
          <p className="measure-line"><b>Recorded outcomes</b>{selected.measured}</p>
          <small>The pulse is a cardiac-state cue. It is not labelled as confidence, truth, or deception.</small>
        </aside>
      </div>

      <div className="miniature-grid three-miniature-grid" aria-label="Choose a 3D card-game preview">
        {scenarios.map((scenario, index) => (
          <button
            type="button"
            className={`miniature-option three-option${selected.id === scenario.id ? ' selected' : ''}`}
            onClick={() => chooseScenario(scenario.id)}
            aria-pressed={selected.id === scenario.id}
            key={scenario.id}
          >
            <span className="mini-option-heading"><i>{scenario.number}</i><b>{scenario.title}</b><small>{scenario.oneLine}</small></span>
            <SceneFrame scenario={scenario} phase={(phase + index) % scenario.phases.length} incentive={incentive} compact />
            <span className="open-instructions">Open 3D preview + instructions <b>→</b></span>
          </button>
        ))}
      </div>
    </section>
  );
}
