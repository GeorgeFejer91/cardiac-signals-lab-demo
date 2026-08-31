export type ScenarioId = 'lemons' | 'numbers';
export type IncentiveMode = 'cooperate' | 'compete';
export type CueWindow = 'signal' | 'decision' | 'both';
export type FaceEmotion = 'neutral' | 'happiness' | 'sadness' | 'fear' | 'anger' | 'surprise';
export type BubbleKind = 'thought' | 'speech';

export type ScenarioPublication = {
  authors: string;
  year: number;
  title: string;
  venue: string;
  href: string;
  relevance: string;
};

export type StoryboardBubble = {
  kind: BubbleKind;
  label: string;
  text: string;
};

export type StoryboardFrame = {
  title: string;
  timing: string;
  explanation: string;
  bubbleA: StoryboardBubble;
  bubbleB: StoryboardBubble;
};

export type ScenarioDefinition = {
  id: ScenarioId;
  title: string;
  shortTitle: string;
  roleA: string;
  roleB: string;
  summary: string;
  logic: string;
  measures: string;
  cooperate: string;
  compete: string;
  cueNote: string;
  implementation: string;
  publications: ScenarioPublication[];
  expressionsA: [FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion];
  expressionsB: [FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion];
};

export const scenarios: ScenarioDefinition[] = [
  {
    id: 'lemons',
    title: 'Market for Lemons: Seller–Buyer Game',
    shortTitle: 'Seller–Buyer Game',
    roleA: 'Seller',
    roleB: 'Buyer',
    summary: 'A seller privately learns whether a visually identical virtual car is good or bad. The buyer sees the car but not its condition and must choose Buy or Pass.',
    logic: 'The seller presses Recommend Buy or Recommend Pass. The buyer combines that standardized recommendation with the seller’s cardiac cue when it is visible.',
    measures: 'truthful claims, concealment, purchase accuracy, cue weighting, decision latency, payoff, learning across trials, and dyadic cardiac coupling.',
    cooperate: 'Both players receive the same reward for an efficient decision: buy a reliable car or reject a lemon.',
    compete: 'The seller benefits from a sale, including the sale of a lemon; the buyer benefits only from buying a reliable car or rejecting a lemon.',
    cueNote: 'The edge of the selected recommendation button can pulse during the public recommendation, the buyer’s decision, both intervals, or neither in the hidden control condition.',
    implementation: 'Both headsets render the same car and fixed controls. Only the seller sees the private condition. There is no tablet, conversation, or free text: the seller presses Recommend Buy/Recommend Pass and the buyer presses Buy/Pass.',
    publications: [
      {
        authors: 'Belot & van de Ven',
        year: 2017,
        title: 'How private is private information? The ability to spot deception in an economic game',
        venue: 'Experimental Economics',
        href: 'https://doi.org/10.1007/s10683-015-9474-8',
        relevance: 'Experimental seller–buyer deception game with a privately observed state and conflicting incentives.',
      },
      {
        authors: 'Akerlof',
        year: 1970,
        title: 'The Market for “Lemons”: Quality Uncertainty and the Market Mechanism',
        venue: 'Quarterly Journal of Economics',
        href: 'https://doi.org/10.2307/1879431',
        relevance: 'Foundational model of quality uncertainty between used-car sellers and buyers.',
      },
      {
        authors: 'Zhang, Zhang, Li & Liu',
        year: 2022,
        title: 'Truth-Telling in a Sender–Receiver Game with Information Asymmetry',
        venue: 'Symmetry',
        href: 'https://doi.org/10.3390/sym14081561',
        relevance: 'Shows how payoff information and incentives alter truth telling and receiver trust.',
      },
    ],
    expressionsA: ['neutral', 'surprise', 'neutral', 'fear', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'numbers',
    title: 'Asymmetric-Information Number-Card Game',
    shortTitle: 'Number-Card Game',
    roleA: 'Strong-evidence player',
    roleB: 'Weak-evidence player',
    summary: 'Both players choose which of two number cards is closer to a hidden target. One player receives an exact target; the other receives deliberately ambiguous evidence.',
    logic: 'After a private first choice, the strong-evidence player can send only A, B, or Wait. The weak-evidence player then makes a final private choice while the signal card can carry its sender’s heartbeat.',
    measures: 'initial and final accuracy, information transfer, truthful signalling, withholding, direct deception, exploitation success, revision, decision latency, payoff, and cardiac coupling.',
    cooperate: 'Both players gain only by reaching the correct answer, so the strong-evidence player should transmit useful information.',
    compete: 'Deadlock incentives pay the strong-evidence player most when they choose correctly but induce the partner to choose incorrectly.',
    cueNote: 'The red edge belongs to the public A/B/Wait signal card—not to an explicit confidence report—and follows beat timing only in the selected cue window.',
    implementation: 'Both headsets show identical A/B number cards. The target-information layer is role-specific, and the only public communication is a standardized A, B, or Wait card.',
    publications: [
      {
        authors: 'Pulford, Mangiarulo & Colman',
        year: 2025,
        title: 'Confidence signalling aids deception in strategic interactions',
        venue: 'Scientific Reports',
        href: 'https://doi.org/10.1038/s41598-025-00279-w',
        relevance: 'Original asymmetric-information A/B judgment task with Deadlock-game incentives.',
      },
      {
        authors: 'Pulford, Colman, Buabang & Krockow',
        year: 2018,
        title: 'The persuasive power of knowledge: Testing the confidence heuristic',
        venue: 'Journal of Experimental Psychology: General',
        href: 'https://doi.org/10.1037/xge0000471',
        relevance: 'Common-interest precursor using dyadic judgments and unequal evidence quality.',
      },
      {
        authors: 'Bahrami et al.',
        year: 2010,
        title: 'Optimally interacting minds',
        venue: 'Science',
        href: 'https://doi.org/10.1126/science.1185718',
        relevance: 'Foundational joint-decision paradigm for combining unequal perceptual evidence.',
      },
    ],
    expressionsA: ['neutral', 'surprise', 'neutral', 'fear', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'surprise', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
];

const numberTrials = [
  { a: 44, b: 56, target: 54, coarse: '48–56', correct: 'B' as const },
  { a: 31, b: 47, target: 34, coarse: '31–47', correct: 'A' as const },
  { a: 62, b: 78, target: 74, coarse: '66–78', correct: 'B' as const },
];

export function getNumberTrial(trial: number) {
  return numberTrials[(Math.max(1, trial) - 1) % numberTrials.length];
}

export function getCarTrial(trial: number) {
  const lemon = trial % 2 === 1;
  return {
    quality: lemon ? 'LEMON' : 'RELIABLE',
    evidence: lemon ? '82,000 MILES' : '41,000 MILES',
    correctAction: lemon ? 'PASS' : 'BUY',
  } as const;
}

export function getStoryboardFrame(
  scenarioId: ScenarioId,
  incentive: IncentiveMode,
  trial: number,
  phase: number,
): StoryboardFrame {
  if (scenarioId === 'lemons') {
    const car = getCarTrial(trial);
    const condition = car.quality === 'LEMON' ? 'BAD CAR' : 'GOOD CAR';
    const sellerAction = incentive === 'cooperate' ? car.correctAction : 'BUY';
    const buyerAction = incentive === 'cooperate' ? car.correctAction : 'BUY';
    const efficient = buyerAction === car.correctAction;
    const frames: StoryboardFrame[] = [
      {
        title: 'A car enters the shared scene',
        timing: '2 seconds',
        explanation: 'The car scales into the center of the table. Seller and Buyer see the same exterior; no quality label, controls, or cardiac cue is visible.',
        bubbleA: { kind: 'thought', label: 'SELLER', text: 'A new car.' },
        bubbleB: { kind: 'thought', label: 'BUYER', text: 'I see the car.' },
      },
      {
        title: 'Only the seller learns the condition',
        timing: '4 seconds',
        explanation: `The seller’s private annotation identifies a ${condition.toLowerCase()}. The car remains visually unchanged in the buyer’s view, making the information asymmetry explicit.`,
        bubbleA: { kind: 'thought', label: 'SELLER · PRIVATE', text: `It is a ${condition.toLowerCase()}.` },
        bubbleB: { kind: 'thought', label: 'BUYER · PRIVATE', text: 'I cannot see its condition.' },
      },
      {
        title: 'The seller chooses a recommendation',
        timing: 'Up to 8 seconds',
        explanation: 'Recommend Buy and Recommend Pass rise beside the seller. Both remain unpressed while the seller chooses under the current payoff rule.',
        bubbleA: { kind: 'thought', label: 'SELLER · PRIVATE', text: 'Which recommendation benefits me?' },
        bubbleB: { kind: 'thought', label: 'BUYER · PRIVATE', text: 'I wait for one fixed recommendation.' },
      },
      {
        title: 'The seller presses one recommendation',
        timing: 'Up to 8 seconds',
        explanation: `The seller presses Recommend ${sellerAction}. The selected button depresses and its red edge follows the seller’s heartbeat when the signal cue is enabled.`,
        bubbleA: { kind: 'speech', label: 'SELLER · BUTTON', text: `Recommend ${sellerAction}.` },
        bubbleB: { kind: 'thought', label: 'BUYER · PRIVATE', text: 'I see the recommendation and cue.' },
      },
      {
        title: 'The buyer chooses Buy or Pass',
        timing: 'Up to 10 seconds',
        explanation: `Buy and Pass rise beside the buyer, who presses ${buyerAction}. The seller’s selected recommendation remains visible and can keep pulsing during this decision window.`,
        bubbleA: { kind: 'thought', label: 'SELLER · PRIVATE', text: 'Waiting for the decision.' },
        bubbleB: { kind: 'speech', label: 'BUYER · BUTTON', text: `${buyerAction}.` },
      },
      {
        title: 'The condition and outcome are revealed',
        timing: '2 seconds',
        explanation: 'The car changes color and a GOOD CAR or BAD CAR status plate rises above it while the chosen controls remain depressed. The system records recommendation, choice, accuracy, payoff, timing, and physiology.',
        bubbleA: { kind: 'thought', label: 'SELLER · OUTCOME', text: efficient ? 'The choice matched the car.' : 'The sale benefited me.' },
        bubbleB: { kind: 'thought', label: 'BUYER · OUTCOME', text: efficient ? 'I made the efficient choice.' : 'My choice did not match the car.' },
      },
    ];
    return frames[phase % frames.length];
  }

  const numbers = getNumberTrial(trial);
  const falseSignal = numbers.correct === 'A' ? 'B' : 'A';
  const signal = incentive === 'cooperate' ? numbers.correct : trial % 2 === 0 ? 'WAIT' : falseSignal;
  const weakFinal = incentive === 'cooperate' ? numbers.correct : signal === 'WAIT' ? falseSignal : signal;
  const exploited = weakFinal !== numbers.correct;
  const frames: StoryboardFrame[] = [
    {
      title: 'Two candidate cards appear',
      timing: '2 seconds',
      explanation: `Cards A = ${numbers.a} and B = ${numbers.b} rise into the shared center. Both players see them, but no evidence panel or response is visible yet.`,
      bubbleA: { kind: 'thought', label: 'STRONG PLAYER', text: 'Two possible answers.' },
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER', text: 'We see the same cards.' },
    },
    {
      title: 'Evidence quality is assigned privately',
      timing: '4 seconds',
      explanation: `An EXACT ${numbers.target} panel rises beside the strong player while a RANGE ${numbers.coarse} panel rises beside the weak player. Each represents private headset content.`,
      bubbleA: { kind: 'thought', label: 'STRONG · PRIVATE', text: `Exact target: ${numbers.target}.` },
      bubbleB: { kind: 'thought', label: 'WEAK · PRIVATE', text: `Target range: ${numbers.coarse}.` },
    },
    {
      title: 'Both make an initial private choice',
      timing: 'Up to 8 seconds',
      explanation: 'A private-choice card slides toward each player and stays on that player’s side of the table. These unrevealed choices establish the pre-signal accuracy baseline.',
      bubbleA: { kind: 'thought', label: 'STRONG · PRIVATE', text: `My first choice: ${numbers.correct}.` },
      bubbleB: { kind: 'thought', label: 'WEAK · PRIVATE', text: 'My evidence is ambiguous.' },
    },
    {
      title: 'The strong player sends A, B or Wait',
      timing: 'Up to 8 seconds',
      explanation: 'The selected A, B, or Wait signal card moves from the strong player to the shared center. Its red edge shows live, replayed, or hidden cardiac timing.',
      bubbleA: { kind: 'speech', label: 'STRONG · SIGNAL CARD', text: `Signal: ${signal}.` },
      bubbleB: { kind: 'thought', label: 'WEAK · PRIVATE', text: 'Should I trust this signal?' },
    },
    {
      title: 'The weak player locks a final answer',
      timing: 'Up to 10 seconds',
      explanation: 'A final A or B card slides from the weak player toward the shared center. The signal card can continue pulsing, but no confidence rating is added.',
      bubbleA: { kind: 'thought', label: 'STRONG · PRIVATE', text: 'My final answer stays private.' },
      bubbleB: { kind: 'speech', label: 'WEAK · FINAL CARD', text: `Final choice: ${weakFinal}.` },
    },
    {
      title: 'Accuracy and strategy are recorded',
      timing: '2 seconds',
      explanation: `A cyan TARGET ${numbers.target} status plate rises behind the still-visible A and B alternatives. The system records accuracy, revision, information transfer, deception, payoff, timing, and cardiac coupling.`,
      bubbleA: { kind: 'thought', label: 'STRONG PLAYER · OUTCOME', text: exploited ? 'I was correct alone.' : 'We reached the correct answer.' },
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER · OUTCOME', text: exploited ? 'The signal led me away from the target.' : 'My final answer was correct.' },
    },
  ];
  return frames[phase % frames.length];
}

export function isCueActive(phase: number, cueWindow: CueWindow) {
  if (cueWindow === 'signal') return phase === 3;
  if (cueWindow === 'decision') return phase === 4;
  return phase === 3 || phase === 4;
}

export function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}
