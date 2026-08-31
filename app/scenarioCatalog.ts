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
    summary: 'A seller privately sees whether a virtual car is reliable or a lemon. The buyer sees the same car but receives only standardized, incomplete evidence and must choose Buy or Pass.',
    logic: 'The seller can truthfully share or strategically conceal the hidden quality through a fixed claim card. The buyer combines that claim, partial vehicle evidence, and—when enabled—the seller’s cardiac cue.',
    measures: 'truthful claims, concealment, purchase accuracy, cue weighting, decision latency, payoff, learning across trials, and dyadic cardiac coupling.',
    cooperate: 'Both players receive the same reward for an efficient decision: buy a reliable car or reject a lemon.',
    compete: 'The seller benefits from a sale, including the sale of a lemon; the buyer benefits only from buying a reliable car or rejecting a lemon.',
    cueNote: 'The seller’s claim card can pulse during the public signal, the buyer’s decision, both intervals, or neither in the hidden control condition.',
    implementation: 'Each headset renders the same car and response controls, while private inspection and partial evidence layers differ by role. All communication is restricted to prewritten claim and Buy/Pass cards.',
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
    const truthfulClaim = car.quality === 'LEMON' ? 'NEEDS REPAIR' : 'RELIABLE';
    const claim = incentive === 'cooperate' || car.quality === 'RELIABLE' ? truthfulClaim : 'RELIABLE';
    const buyerAction = incentive === 'cooperate' ? car.correctAction : 'BUY';
    const efficient = buyerAction === car.correctAction;
    const frames: StoryboardFrame[] = [
      {
        title: 'A new car appears',
        timing: '2 seconds',
        explanation: 'Both players see the same virtual vehicle. Neither player has made a decision, and no cardiac information is displayed.',
        bubbleA: { kind: 'thought', label: 'SELLER · PRIVATE', text: 'A new vehicle.' },
        bubbleB: { kind: 'thought', label: 'BUYER · PRIVATE', text: 'I see the same car.' },
      },
      {
        title: 'The seller receives the hidden state',
        timing: '4 seconds',
        explanation: 'Only the seller’s headset shows the full inspection. The thought bubble is a storyboard annotation: the buyer cannot see this information.',
        bubbleA: { kind: 'thought', label: 'SELLER · PRIVATE', text: `Inspection: ${car.quality}.` },
        bubbleB: { kind: 'thought', label: 'BUYER · PRIVATE', text: 'The inspection is hidden from me.' },
      },
      {
        title: 'The buyer receives partial evidence',
        timing: '4 seconds',
        explanation: 'The buyer sees one standardized but nondiagnostic fact. Separate headset layers make this asymmetric evidence easy to control in VR.',
        bubbleA: { kind: 'thought', label: 'SELLER · PRIVATE', text: 'I know the complete quality.' },
        bubbleB: { kind: 'thought', label: 'BUYER · PRIVATE', text: `I only see ${car.evidence.toLowerCase()}.` },
      },
      {
        title: 'The seller sends one fixed claim',
        timing: 'Up to 8 seconds',
        explanation: 'The seller cannot talk or type. They select one prewritten claim card. When the signal cue window is enabled, this card’s red edge follows the seller’s heartbeat.',
        bubbleA: { kind: 'speech', label: 'SELLER · PUBLIC CARD', text: `Claim: ${claim}.` },
        bubbleB: { kind: 'thought', label: 'BUYER · PRIVATE', text: 'I weigh the claim and its cardiac cue.' },
      },
      {
        title: 'The buyer chooses Buy or Pass',
        timing: 'Up to 10 seconds',
        explanation: 'The buyer selects one standardized action. A decision-window condition can keep the seller’s cardiac edge visible during this choice.',
        bubbleA: { kind: 'thought', label: 'SELLER · PRIVATE', text: 'Waiting for the decision.' },
        bubbleB: { kind: 'speech', label: 'BUYER · PUBLIC CARD', text: `Decision: ${buyerAction}.` },
      },
      {
        title: 'The trial is recorded',
        timing: '2 seconds',
        explanation: 'The system records the hidden state, claim, choice, response times, payoff and physiology. The next click begins a new trial with a newly assigned state.',
        bubbleA: { kind: 'thought', label: 'SELLER · OUTCOME', text: efficient ? 'Efficient decision.' : 'The hidden state shaped the payoff.' },
        bubbleB: { kind: 'thought', label: 'BUYER · OUTCOME', text: efficient ? 'My choice matched the quality.' : 'My choice did not match the quality.' },
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
      explanation: `Both players see the same alternatives: A = ${numbers.a} and B = ${numbers.b}. The objectively correct answer is defined by the hidden target.`,
      bubbleA: { kind: 'thought', label: 'STRONG PLAYER · PRIVATE', text: 'Two possible answers.' },
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER · PRIVATE', text: 'We see the same cards.' },
    },
    {
      title: 'Evidence quality is assigned privately',
      timing: '4 seconds',
      explanation: `The strong player sees the exact target (${numbers.target}). The weak player sees only the broad interval ${numbers.coarse}, making the A/B judgment ambiguous.`,
      bubbleA: { kind: 'thought', label: 'STRONG PLAYER · PRIVATE', text: `Exact target: ${numbers.target}.` },
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER · PRIVATE', text: `Target range: ${numbers.coarse}.` },
    },
    {
      title: 'Both make an initial private choice',
      timing: 'Up to 8 seconds',
      explanation: 'The initial A/B responses are never shown to the partner. They provide a baseline for measuring whether the later signal changes the weak player’s judgment.',
      bubbleA: { kind: 'thought', label: 'STRONG PLAYER · PRIVATE', text: `My first choice: ${numbers.correct}.` },
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER · PRIVATE', text: 'My evidence is ambiguous.' },
    },
    {
      title: 'The strong player sends A, B or Wait',
      timing: 'Up to 8 seconds',
      explanation: 'This is the only communication channel. The red card edge can show live, yoked or hidden cardiac timing during the signal interval.',
      bubbleA: { kind: 'speech', label: 'STRONG PLAYER · PUBLIC CARD', text: `Signal: ${signal}.` },
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER · PRIVATE', text: 'Should I trust this signal?' },
    },
    {
      title: 'The weak player locks a final answer',
      timing: 'Up to 10 seconds',
      explanation: 'The weak player privately chooses A or B. Cardiac visibility can continue into this decision interval without adding any confidence rating.',
      bubbleA: { kind: 'thought', label: 'STRONG PLAYER · PRIVATE', text: 'My final answer stays private.' },
      bubbleB: { kind: 'speech', label: 'WEAK PLAYER · RESPONSE', text: `Final choice: ${weakFinal}.` },
    },
    {
      title: 'Accuracy and strategy are recorded',
      timing: '2 seconds',
      explanation: 'The trial yields objective accuracy, revision, information transfer, withholding or deception, exploitation, payoff, decision time and cardiac coupling.',
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
