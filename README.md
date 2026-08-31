# Cardiac Signals Lab demo

A static, browser-only GitHub Pages preview of two proposed mixed-reality dyadic experiments.

**Live demo:** https://georgefejer91.github.io/cardiac-signals-lab-demo/

The landing page contains two accordion choices:

1. **Market for Lemons: Seller–Buyer Game** — a seller privately sees whether a visually identical virtual car is good or bad, presses Recommend Buy or Recommend Pass, and the uninformed buyer presses Buy or Pass.
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

Each phase shows at most one **thought bubble** containing the currently relevant participant’s private inner monologue; the protocol contains no speech. Observable actions are shown only by one of two physical push buttons depressing in front of the relevant participant. The bubble and its SVG trail sit behind the avatar’s head so they remain anchored without covering the face.

The bubble silhouette is a complete SVG path with centered, length-responsive text embedded in the SVG. Each thought trail is recalculated from the cloud boundary to the projected 3D center of the corresponding avatar’s head, while reserved screen zones keep the cloud itself clear of the table actions and cardiac-status badge.

The car scenario deliberately contains no tablet, negotiation, or free-form claim card. It cycles through four CC0 Kenney vehicle models and alternating reliable/lemon states. Every round shows a computer-set 20-token price and four colored physical controls: Recommend Buy/Recommend Pass for the seller and Buy/Pass for the buyer. During cardiac-access phases, the seller’s chest heart, selected recommendation edge, and tabletop pulse together; an explicitly illustrative physiology panel is then available to the buyer. The number-card scenario retains its two numbered stimulus cards but represents both participants’ A/B choices with two push buttons directly in front of each avatar.

The priced-car game is a **fixed-price, lemons-inspired adaptation**, not a literal reproduction of Belot and van de Ven’s task. A reliable car is worth 30 tokens and a lemon 10, while the fixed 20-token price makes buying worth +10 or −10 to the buyer. Passing is worth zero. In aligned blocks the seller shares this result; in opposed blocks the seller receives a 10-token sales commission. A ten-token endowment protects participants from real losses, and only selected rounds are converted to money after the session.

## Experimental interpretation

The cardiac display is framed as a **cardiac-state cue**, not as a confidence indicator, emotion decoder, or lie detector. A full study can compare live, yoked-replay, and hidden conditions even though the storyboard illustrates the timing manipulation most directly.

Primary behavioral outcomes include truth telling, concealment, decision accuracy, information transfer, choice revision, cue weighting, response latency, payoff, exploitation success, learning, and dyadic cardiac coupling.

## Sources

- Pulford BD, Mangiarulo M, Colman AM. [Confidence signalling aids deception in strategic interactions](https://doi.org/10.1038/s41598-025-00279-w). *Scientific Reports*. 2025.
- Pulford BD, Colman AM, Buabang EK, Krockow EM. [The persuasive power of knowledge: Testing the confidence heuristic](https://doi.org/10.1037/xge0000471). *Journal of Experimental Psychology: General*. 2018.
- Bahrami B, et al. [Optimally interacting minds](https://doi.org/10.1126/science.1185718). *Science*. 2010.
- Belot M, van de Ven J. [How private is private information? The ability to spot deception in an economic game](https://doi.org/10.1007/s10683-015-9474-8). *Experimental Economics*. 2017.
- Eriksson K, Simpson B. [Deception and price in a market with asymmetric information](https://doi.org/10.1017/S1930297500000243). *Judgment and Decision Making*. 2007.
- Akerlof GA. [The Market for “Lemons”: Quality Uncertainty and the Market Mechanism](https://doi.org/10.2307/1879431). *Quarterly Journal of Economics*. 1970.
- Kenney. [Car Kit 3.1](https://kenney.nl/assets/car-kit). CC0 1.0 Universal.

## Local development

Requirements: Node.js 22.13 or newer.

    npm install
    npm run dev

Validation and static GitHub Pages export:

    npm run lint
    npm run build
    npm run build:pages

`npm run build:pages` writes the static deployment to `out/`. GitHub Pages is the sole publication target.
