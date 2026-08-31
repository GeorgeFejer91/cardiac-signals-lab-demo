import ExperimentMiniatures from './ExperimentMiniatures';

function LabMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /></span>;
}

export default function Home() {
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
