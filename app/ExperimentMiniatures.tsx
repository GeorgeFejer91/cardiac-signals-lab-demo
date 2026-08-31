'use client';

import { useEffect, useState } from 'react';
import StoryboardBubble from './StoryboardBubble';
import ThreeTableScene from './ThreeTableScene';
import {
  type CueWindow,
  type IncentiveMode,
  type ScenarioId,
  getStoryboardFrame,
  isCueActive,
  scenarios,
} from './scenarioCatalog';

const PHASE_COUNT = 6;
const AUTO_ADVANCE_MS = 6500;

function GameWidget({ id }: { id: ScenarioId }) {
  if (id === 'lemons') {
    return <span className="game-choice-widget lemons" aria-hidden="true"><i>CAR</i><i>?</i></span>;
  }
  return <span className="game-choice-widget numbers" aria-hidden="true"><i>A<br />44</i><i>B<br />56</i></span>;
}

export default function ExperimentMiniatures() {
  const [activeId, setActiveId] = useState<ScenarioId | null>(null);
  const [phase, setPhase] = useState(0);
  const [trial, setTrial] = useState(1);
  const [incentive, setIncentive] = useState<IncentiveMode>('cooperate');
  const [cueWindow, setCueWindow] = useState<CueWindow>('signal');
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
    setIncentive('cooperate');
    setCueWindow('signal');
    setAutoAdvance(false);
  };

  const changeIncentive = (value: IncentiveMode) => {
    setIncentive(value);
    setPhase(0);
    setTrial(1);
    setAutoAdvance(false);
  };

  return (
    <section className="scenario-accordion" aria-label="Choose a 3D game storyboard">
      {scenarios.map((scenario) => {
        const open = scenario.id === activeId;
        const frame = getStoryboardFrame(scenario.id, incentive, trial, phase, cueWindow);
        const modeText = incentive === 'cooperate' ? scenario.cooperate : scenario.compete;
        const cueActive = isCueActive(phase, cueWindow);

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
                <small>Interactive implementation</small>
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
                      <button type="button" className={incentive === 'cooperate' ? 'active' : ''} aria-pressed={incentive === 'cooperate'} onClick={() => changeIncentive('cooperate')}>Collaborate</button>
                      <button type="button" className={incentive === 'compete' ? 'active compete' : ''} aria-pressed={incentive === 'compete'} onClick={() => changeIncentive('compete')}>Compete</button>
                    </div>
                    <div className="cue-window-toggle" role="group" aria-label="When the cardiac cue is available">
                      <span>Cue window</span>
                      {(['signal', 'decision', 'both'] as CueWindow[]).map((value) => (
                        <button type="button" className={cueWindow === value ? 'active' : ''} aria-pressed={cueWindow === value} onClick={() => setCueWindow(value)} key={value}>
                          {value === 'signal' ? 'Signal' : value === 'decision' ? 'Decision' : 'Both'}
                        </button>
                      ))}
                    </div>
                  </header>

                  <div className="storyboard-scene">
                    <ThreeTableScene scenarioId={scenario.id} phase={phase} incentive={incentive} trial={trial} cueWindow={cueWindow} />
                    <div className="storyboard-role role-a"><i />{scenario.roleA}</div>
                    <div className="storyboard-role role-b"><i />{scenario.roleB}</div>
                    <StoryboardBubble player="a" bubble={frame.bubbleA} />
                    <StoryboardBubble player="b" bubble={frame.bubbleB} />
                    <div className={`cue-window-badge${cueActive ? ' active' : ''}`}>
                      <i aria-hidden="true" />
                      {cueActive ? 'Cardiac edge visible now' : 'Cardiac edge hidden in this phase'}
                    </div>
                  </div>

                  <nav className="storyboard-navigation" aria-label="Storyboard controls">
                    <button type="button" className="storyboard-arrow" onClick={moveBack} disabled={trial === 1 && phase === 0} aria-label="Previous phase">←</button>
                    <div className="storyboard-progress">
                      <span>Trial {trial}</span>
                      <div>
                        {Array.from({ length: PHASE_COUNT }, (_, index) => (
                          <button type="button" className={index === phase ? 'active' : ''} onClick={() => { setPhase(index); setAutoAdvance(false); }} aria-label={`Go to phase ${index + 1}`} aria-current={index === phase ? 'step' : undefined} key={index} />
                        ))}
                      </div>
                      <strong>{phase + 1} / {PHASE_COUNT}</strong>
                    </div>
                    <button type="button" className="storyboard-arrow next" onClick={moveForward} aria-label={phase === PHASE_COUNT - 1 ? 'Begin next trial' : 'Next phase'}>→</button>
                    <button type="button" className={`auto-advance${autoAdvance ? ' active' : ''}`} aria-pressed={autoAdvance} onClick={() => setAutoAdvance((value) => !value)}>
                      <i aria-hidden="true" /> Auto advance
                    </button>
                  </nav>

                  <div className="storyboard-caption" aria-live="polite">
                    <div>
                      <span>Phase {phase + 1}</span>
                      <h2>{frame.title}</h2>
                    </div>
                    <p>{frame.explanation}</p>
                    <time>{frame.timing}</time>
                  </div>
                </section>

                <section className="scenario-summary-box" aria-labelledby={`summary-${scenario.id}`}>
                  <header>
                    <span>Plain-language protocol</span>
                    <h2 id={`summary-${scenario.id}`}>How this game would be implemented</h2>
                  </header>
                  <p><strong>{scenario.summary}</strong> {scenario.logic}</p>
                  <dl>
                    <div><dt>VR setup</dt><dd>{scenario.implementation}</dd></div>
                    <div><dt>Incentives</dt><dd>{modeText}</dd></div>
                    <div><dt>Measured</dt><dd>{scenario.measures}</dd></div>
                  </dl>
                  <small><i /> {scenario.cueNote} Every bubble is a private inner monologue used only to explain the storyboard. Participants never speak; observable choices are represented exclusively by the depressed push buttons.</small>
                </section>

                <section className="scenario-publications" aria-labelledby={`publications-${scenario.id}`}>
                  <header>
                    <span>Evidence base</span>
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
