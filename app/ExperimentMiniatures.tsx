'use client';

import { useEffect, useMemo, useState } from 'react';
import ThreeTableScene from './ThreeTableScene';
import { IncentiveMode, ScenarioId, scenarios } from './scenarioCatalog';

export default function ExperimentMiniatures() {
  const [activeId, setActiveId] = useState<ScenarioId>('signal');
  const [phase, setPhase] = useState(0);
  const [incentive, setIncentive] = useState<IncentiveMode>('cooperate');
  const active = useMemo(() => scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0], [activeId]);

  useEffect(() => {
    const timer = window.setInterval(() => setPhase((current) => (current + 1) % active.phases.length), 2200);
    return () => window.clearInterval(timer);
  }, [active]);

  const select = (id: ScenarioId) => {
    setActiveId(id);
    setPhase(0);
  };

  return (
    <section className="scenario-accordion" aria-label="Choose a 3D game scenario">
      {scenarios.map((scenario) => {
        const open = scenario.id === active.id;
        return (
          <article className={`scenario-accordion-item${open ? ' open' : ''}`} key={scenario.id}>
            <button
              type="button"
              className="scenario-accordion-trigger"
              aria-expanded={open}
              aria-controls={`scenario-panel-${scenario.id}`}
              onClick={() => select(scenario.id)}
            >
              <strong>{scenario.title}</strong>
              <i>{open ? '−' : '+'}</i>
            </button>

            {open ? (
              <div className="scenario-accordion-panel" id={`scenario-panel-${scenario.id}`}>
                <div className="minimal-scene-pane">
                  <ThreeTableScene scenarioId={scenario.id} phase={phase} incentive={incentive} />
                  <span className="minimal-player-label player-a">PLAYER A</span>
                  <span className="minimal-player-label player-b">PLAYER B</span>
                  <div className="minimal-phase">
                    <div>{scenario.phases.map((label, index) => <i key={label} className={index === phase ? 'active' : ''} />)}</div>
                    <strong>{scenario.phases[phase]}</strong>
                  </div>
                </div>

                <div className="scenario-summary-box">
                  <p className="scenario-summary-lede">{scenario.summary}</p>
                  <dl className="scenario-facts">
                    <div><dt>Game logic</dt><dd>{scenario.logic}</dd></div>
                    <div><dt>Measures</dt><dd>{scenario.measures}</dd></div>
                  </dl>
                  <div className="scenario-mode-row">
                    <div className="scenario-mode" role="group" aria-label={`${scenario.title} incentive mode`}>
                      <span>MODE</span>
                      <button type="button" className={incentive === 'cooperate' ? 'active' : ''} onClick={() => setIncentive('cooperate')}>Collaborate</button>
                      <button type="button" className={incentive === 'compete' ? 'active compete' : ''} onClick={() => setIncentive('compete')}>Compete</button>
                    </div>
                    <p><b>{incentive === 'cooperate' ? 'Collaboration' : 'Competition'}</b>{incentive === 'cooperate' ? scenario.cooperate : scenario.compete}</p>
                  </div>
                  <div className="scenario-summary-footer">
                    <span className="edge-key"><i /> Red card edge = Player A&apos;s heartbeat</span>
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
