'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import StoryboardBubble from './StoryboardBubble';
import {
  type CueSource,
  type CueWindow,
  type IncentiveMode,
  type ScenarioId,
  getStoryboardFrame,
  isCueActive,
  scenarios,
} from './scenarioCatalog';

const ThreeTableScene = dynamic(() => import('./ThreeTableScene'), {
  ssr: false,
  loading: () => <div className="scene-loading">Loading 3D scene…</div>,
});

const PHASE_COUNT = 6;
const AUTO_ADVANCE_MS = 6500;

function GameWidget({ id }: { id: ScenarioId }) {
  if (id === 'lemons') {
    return <span className="game-choice-widget car" aria-hidden="true"><i /><b>?</b></span>;
  }
  return <span className="game-choice-widget numbers" aria-hidden="true"><i>A<br />31</i><i>B<br />47</i></span>;
}

export default function ExperimentMiniatures() {
  const [activeId, setActiveId] = useState<ScenarioId | null>(null);
  const [phase, setPhase] = useState(0);
  const [trial, setTrial] = useState(1);
  const [incentive, setIncentive] = useState<IncentiveMode>('compete');
  const [cueWindow, setCueWindow] = useState<CueWindow>('both');
  const [cueSource, setCueSource] = useState<CueSource>('live');
  const [autoAdvance, setAutoAdvance] = useState(false);

  const moveForward = () => {
    setPhase((current) => {
      if (current < PHASE_COUNT - 1) return current + 1;
      setTrial((value) => value + 1);
      return 0;
    });
  };

  const moveBack = () => {
    setPhase((current) => {
      if (current > 0) return current - 1;
      if (trial > 1) {
        setTrial((value) => Math.max(1, value - 1));
        return PHASE_COUNT - 1;
      }
      return 0;
    });
  };

  useEffect(() => {
    if (!activeId || !autoAdvance) return;
    const timer = window.setInterval(moveForward, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [activeId, autoAdvance]);

  const select = (id: ScenarioId) => {
    setActiveId((current) => current === id ? null : id);
    setPhase(0);
    setTrial(1);
    setIncentive('compete');
    setCueWindow('both');
    setCueSource('live');
    setAutoAdvance(false);
  };

  const changeIncentive = (value: IncentiveMode) => {
    setIncentive(value);
    setPhase(0);
    setTrial(1);
    setAutoAdvance(false);
  };

  const changeCueSource = (value: CueSource) => {
    setCueSource(value);
    setAutoAdvance(false);
  };

  return (
    <section className="scenario-accordion" aria-label="Choose a 3D game storyboard">
      {scenarios.map((scenario) => {
        const open = scenario.id === activeId;
        const frame = getStoryboardFrame(scenario.id, incentive, trial, phase, cueWindow, cueSource);
        const modeText = incentive === 'cooperate' ? scenario.cooperate : scenario.compete;
        const cueActive = isCueActive(phase, cueWindow, cueSource);

        return (
          <article className={`scenario-accordion-item${open ? ' open' : ''}`} key={scenario.id}>
            <button
              type="button"
              className="scenario-accordion-trigger"
              aria-expanded={open}
              aria-controls={`scenario-panel-${scenario.id}`}
              onClick={() => select(scenario.id)}
            >
              <GameWidget id={scenario.id} />
              <span>
                <strong>{scenario.title}</strong>
              </span>
              <i aria-hidden="true">{open ? '−' : '+'}</i>
            </button>

            {open ? (
              <div className="scenario-accordion-panel" id={`scenario-panel-${scenario.id}`}>
                <section className="minimal-scene-pane" aria-label={`${scenario.title} storyboard`}>
                  <header className="storyboard-toolbar">
                    <div className="storyboard-mode-toggle" role="group" aria-label="Incentive relationship">
                      <span>Payoff</span>
                      <button type="button" className={incentive === 'cooperate' ? 'active' : ''} aria-pressed={incentive === 'cooperate'} onClick={() => changeIncentive('cooperate')}>Aligned</button>
                      <button type="button" className={incentive === 'compete' ? 'active compete' : ''} aria-pressed={incentive === 'compete'} onClick={() => changeIncentive('compete')}>Conflicting</button>
                    </div>
                    <label className="storyboard-select">
                      <span>Cardiac cue</span>
                      <select value={cueSource} onChange={(event) => changeCueSource(event.target.value as CueSource)}>
                        <option value="live">Live</option>
                        <option value="replay">Matched replay</option>
                        <option value="hidden">Hidden</option>
                      </select>
                    </label>
                    <label className="storyboard-select">
                      <span>Shown while</span>
                      <select value={cueWindow} disabled={cueSource === 'hidden'} onChange={(event) => { setCueWindow(event.target.value as CueWindow); setAutoAdvance(false); }}>
                        <option value="signal">Recommendation</option>
                        <option value="decision">Receiver decides</option>
                        <option value="both">Both stages</option>
                      </select>
                    </label>
                  </header>

                  <div className="storyboard-scene">
                    <ThreeTableScene scenarioId={scenario.id} phase={phase} incentive={incentive} trial={trial} cueWindow={cueWindow} cueSource={cueSource} />
                    <div className="scene-status" aria-live="polite">{frame.sceneLabel}</div>
                    {frame.bubbleA ? <StoryboardBubble player="a" bubble={frame.bubbleA} /> : null}
                    {frame.bubbleB ? <StoryboardBubble player="b" bubble={frame.bubbleB} /> : null}
                    <div className="storyboard-viewer-note">Thoughts are explanatory; participants do not see them.</div>
                    <div className={`cue-window-badge${cueActive ? ' active' : ''}`}>
                      <i aria-hidden="true" />
                      {cueSource === 'hidden'
                        ? 'Cardiac cue hidden in this condition'
                        : cueActive
                          ? `${cueSource === 'replay' ? 'Matched replay' : 'Live cardiac cue'} visible now`
                          : 'Cardiac cue not shown in this phase'}
                    </div>
                  </div>

                  <div className="storyboard-caption" aria-live="polite">
                    <div>
                      <span>Step {phase + 1}</span>
                      <h2>{frame.title}</h2>
                    </div>
                    <p>{frame.explanation}</p>
                    <time>{frame.timing}</time>
                  </div>

                  <nav className="storyboard-navigation" aria-label="Storyboard controls">
                    <button type="button" className="storyboard-arrow" onClick={moveBack} disabled={trial === 1 && phase === 0} aria-label="Previous phase">←</button>
                    <div className="storyboard-progress">
                      <span>Trial {trial}</span>
                      <div>
                        {Array.from({ length: PHASE_COUNT }, (_, index) => (
                          <button type="button" className={index === phase ? 'active' : ''} onClick={() => { setPhase(index); setAutoAdvance(false); }} aria-label={`Go to step ${index + 1}`} aria-current={index === phase ? 'step' : undefined} key={index}>{index + 1}</button>
                        ))}
                      </div>
                      <strong>Step {phase + 1} / {PHASE_COUNT}</strong>
                    </div>
                    <button type="button" className="storyboard-arrow next" onClick={moveForward} aria-label={phase === PHASE_COUNT - 1 ? 'Begin next trial' : 'Next phase'}>→</button>
                    <button type="button" className={`auto-advance${autoAdvance ? ' active' : ''}`} aria-pressed={autoAdvance} onClick={() => setAutoAdvance((value) => !value)}>
                      <i aria-hidden="true" /> Auto advance
                    </button>
                  </nav>
                </section>

                <section className="scenario-summary-box" aria-labelledby={`summary-${scenario.id}`}>
                  <header>
                    <h2 id={`summary-${scenario.id}`}>How this game works</h2>
                  </header>
                  <p><strong>{scenario.summary}</strong> {scenario.logic}</p>
                  <dl>
                    <div><dt>VR setup</dt><dd>{scenario.implementation}</dd></div>
                    <div><dt>Lab stakes</dt><dd>{scenario.stakes}</dd></div>
                    <div><dt>Incentives</dt><dd>{modeText}</dd></div>
                    <div><dt>Measured</dt><dd>{scenario.measures}</dd></div>
                  </dl>
                  <small><i /> {scenario.cueNote} Participants never speak; observable choices are represented exclusively by the depressed push buttons.</small>
                </section>

                <section className="scenario-publications" aria-labelledby={`publications-${scenario.id}`}>
                  <header>
                    <h2 id={`publications-${scenario.id}`}>Relevant publications</h2>
                  </header>
                  <div>
                    {scenario.publications.map((publication) => (
                      <a href={publication.href} target="_blank" rel="noreferrer" key={publication.href}>
                        <span>{publication.authors} · {publication.year}</span>
                        <strong>{publication.title}</strong>
                        <small>{publication.venue} — {publication.relevance}</small>
                        <i aria-hidden="true">↗</i>
                      </a>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
