# Cardiac Signals Lab demo

A static, browser-only GitHub Pages preview of two proposed mixed-reality dyadic experiments.

**Live demo:** https://georgefejer91.github.io/grants/

The landing page contains two accordion choices:

1. **Market for Lemons: Seller–Buyer Game** — a seller privately sees whether a virtual car is reliable or a lemon; a partially informed buyer selects Buy or Pass.
2. **Asymmetric-Information Number-Card Game** — two players judge which number card is closer to a target, but one receives exact evidence and the other receives an ambiguous range.

## Storyboard interaction

Each accordion opens a discrete six-phase storyboard rather than a participant task. The viewer can:

- step backward and forward through every phase;
- click any phase dot directly;
- enable a deliberately slow 6.5-second auto-advance;
- continue into repeated trials with changing hidden states;
- switch between collaborative and competitive incentives; and
- move the cardiac display between the public-signal interval, decision interval, or both.

The 3D scene uses a minimal table, two Social Threat Lab-style avatar busts, continuously morphing facial expressions, and only the props needed for the current experiment. The card-edge cardiac cue is a red, beat-synchronous emissive glow.

Private states and public actions are represented differently:

- **Thought bubbles** annotate information available only inside one participant’s headset.
- **Speech bubbles** annotate standardized public claim or response cards. They do not imply that participants can talk.

Both bubble silhouettes are complete SVG paths with dynamic text embedded in the SVG. Their tails or thought trails are positioned toward the corresponding avatar heads.

## Experimental interpretation

The cardiac display is framed as a **cardiac-state cue**, not as a confidence indicator, emotion decoder, or lie detector. A full study can compare live, yoked-replay, and hidden conditions even though the storyboard illustrates the timing manipulation most directly.

Primary behavioral outcomes include truth telling, concealment, decision accuracy, information transfer, choice revision, cue weighting, response latency, payoff, exploitation success, learning, and dyadic cardiac coupling.

## Sources

- Pulford BD, Mangiarulo M, Colman AM. [Confidence signalling aids deception in strategic interactions](https://doi.org/10.1038/s41598-025-00279-w). *Scientific Reports*. 2025.
- Pulford BD, Colman AM, Buabang EK, Krockow EM. [The persuasive power of knowledge: Testing the confidence heuristic](https://doi.org/10.1037/xge0000471). *Journal of Experimental Psychology: General*. 2018.
- Bahrami B, et al. [Optimally interacting minds](https://doi.org/10.1126/science.1185718). *Science*. 2010.
- Belot M, van de Ven J. [How private is private information? The ability to spot deception in an economic game](https://doi.org/10.1007/s10683-015-9474-8). *Experimental Economics*. 2017.
- Akerlof GA. [The Market for “Lemons”: Quality Uncertainty and the Market Mechanism](https://doi.org/10.2307/1879431). *Quarterly Journal of Economics*. 1970.

## Local development

Requirements: Node.js 22.13 or newer.

    npm install
    npm run dev

Validation and static GitHub Pages export:

    npm run lint
    npm run build
    npm run build:pages

`npm run build:pages` writes the static deployment to `out/`. GitHub Pages is the sole publication target.
