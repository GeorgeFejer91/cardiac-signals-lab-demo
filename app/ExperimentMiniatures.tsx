'use client';

import { useEffect, useState } from 'react';
import ThreeTableScene from './ThreeTableScene';
import { IncentiveMode, ScenarioId, scenarios } from './scenarioCatalog';

function GameWidget({ id }: { id: ScenarioId }) {
  if (id === 'concealed') {
    return <span className="game-choice-widget concealed" aria-hidden="true">{['7', 'Q', '4', '9'].map((card) => <i key={card}>{card}</i>)}</span>;
  }
  if (id === 'dilemma') {
    return <span className="game-choice-widget dilemma" aria-hidden="true"><i>C</i><i>D</i></span>;
  }
  if (id === 'ultimatum') {
    return <span className="game-choice-widget ultimatum" aria-hidden="true"><i>7/3</i><i>✓</i></span>;
  }
  return <span className="game-choice-widget signal" aria-hidden="true"><i>A</i><i>B</i></span>;
}

export default function ExperimentMiniatures() {
  const [activeId, setActiveId] = useState<ScenarioId | null>(null);
  const [phase, setPhase] = useState(0);
  const [incentive, setIncentive] = useState<IncentiveMode>('cooperate');

  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => setPhase((current) => (current + 1) % 5), 2400);
    return () => window.clearInterval(timer);
  }, [activeId]);

  const select = (id: ScenarioId) => {
    setActiveId((current) => current === id ? null : id);
    setPhase(0);
  };

  return (
    <section className="scenario-accordion" aria-label="Choose a 3D game scenario">
      {scenarios.map((scenario) => {
        const open = scenario.id === activeId;
        const modeText = incentive === 'cooperate' ? scenario.cooperate : scenario.compete;
        const speechA = incentive === 'cooperate' ? scenario.speechA : scenario.speechACompete;
        const speechB = incentive === 'cooperate' ? scenario.speechB : scenario.speechBCompete;
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
              <strong>{scenario.title}</strong>
              <i>{open ? '−' : '+'}</i>
            </button>

            {open ? (
              <div className="scenario-accordion-panel" id={`scenario-panel-${scenario.id}`}>
                <div className="minimal-scene-pane">
                  <ThreeTableScene scenarioId={scenario.id} phase={phase} incentive={incentive} />

                  <div className="preview-mode-toggle" role="group" aria-label={`${scenario.title} incentive mode`}>
                    <button type="button" className={incentive === 'cooperate' ? 'active' : ''} onClick={() => setIncentive('cooperate')}>Collaborate</button>
                    <button type="button" className={incentive === 'compete' ? 'active compete' : ''} onClick={() => setIncentive('compete')}>Compete</button>
                  </div>

                  <div className="sequence-speech player-a"><span>PLAYER A</span>{speechA[phase]}</div>
                  <div className="sequence-speech player-b"><span>PLAYER B</span>{speechB[phase]}</div>

                  <div className="minimal-phase">
                    <div>{scenario.phases.map((label, index) => <i key={label} className={index === phase ? 'active' : ''} />)}</div>
                    <strong>{phase + 1} / 5 · {scenario.phases[phase]}</strong>
                  </div>
                </div>

                <div className="scenario-summary-box">
                  <p><strong>{scenario.summary}</strong> {scenario.logic} The recorded outcomes are {scenario.measures.toLowerCase()}</p>
                  <p className="scenario-mode-prose"><b>{incentive === 'cooperate' ? 'Collaborative mode:' : 'Competitive mode:'}</b> {modeText}</p>
                  <small><i /> The red card edge follows Player A&apos;s heartbeat timing; it is not labelled as confidence or deception.</small>
                </div>

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
