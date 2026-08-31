export type ScenarioId = 'lemons' | 'numbers';
export type IncentiveMode = 'cooperate' | 'compete';
export type CueWindow = 'signal' | 'decision' | 'both';
export type FaceEmotion = 'neutral' | 'happiness' | 'sadness' | 'fear' | 'anger' | 'surprise';
export type BubbleKind = 'thought';

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
  bubbleA?: StoryboardBubble;
  bubbleB?: StoryboardBubble;
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
  stakes: string;
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
    summary: 'A seller privately learns whether a virtual car is reliable or a lemon. The buyer sees the same car and its computer-set price, but not its condition, and must choose Buy or Pass.',
    logic: 'The seller presses Recommend Buy or Recommend Pass. The buyer combines that standardized recommendation with the seller’s cardiac cue when it is visible.',
    measures: 'truthful claims, concealment, purchase accuracy, cue weighting, decision latency, payoff, learning across trials, and dyadic cardiac coupling.',
    cooperate: 'Both players share the buyer’s market outcome: gain from buying a reliable car, lose from buying a lemon, and receive zero from passing.',
    compete: 'The seller benefits from a sale, including the sale of a lemon; the buyer benefits only from buying a reliable car or rejecting a lemon.',
    cueNote: 'During the selected cue window, a heart pinned to the seller and the tabletop pulse with the seller’s beat. At the buyer’s decision, a summary of the observed window can also show baseline-normalized cardiac metrics. The preview values are illustrative, and none is labelled as truth, confidence, or deception.',
    implementation: 'Both headsets render the same priced car and the same four fixed controls. The price stays fixed at 20 tokens, while vehicle model and reliable/lemon status rotate across trials and would be counterbalanced independently. There is no tablet, bargaining, conversation, or free text: the seller presses Recommend Buy/Recommend Pass and the buyer presses Buy/Pass.',
    stakes: 'The computer fixes the price at 20 tokens; neither player negotiates it. A reliable car is worth 30 and a lemon 10, so buying yields the buyer +10 or −10 and passing yields 0. In aligned blocks the seller shares that outcome; in opposed blocks the seller instead earns a 10-token commission for any sale. A 10-token trial endowment prevents real losses, and selected trials are converted to money after the session.',
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
        authors: 'Eriksson & Simpson',
        year: 2007,
        title: 'Deception and price in a market with asymmetric information',
        venue: 'Judgment and Decision Making',
        href: 'https://doi.org/10.1017/S1930297500000243',
        relevance: 'Price–quality experiment showing that seller-chosen prices themselves become informative cues, motivating a fixed computer-set price here.',
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
    logic: 'After private initial A/B choices, the strong-evidence player makes a standardized A/B recommendation. The weak-evidence player then locks a final A/B choice while the selected recommendation button can carry its sender’s heartbeat.',
    measures: 'initial and final accuracy, information transfer, truthful signalling, withholding, direct deception, exploitation success, revision, decision latency, payoff, and cardiac coupling.',
    cooperate: 'Both players gain only by reaching the correct answer, so the strong-evidence player should transmit useful information.',
    compete: 'Deadlock incentives pay the strong-evidence player most when they choose correctly but induce the partner to choose incorrectly.',
    cueNote: 'The red edge belongs to the selected A/B recommendation button—not to an explicit confidence report—and follows beat timing only in the selected cue window.',
    implementation: 'Both headsets show identical A/B number cards as shared stimuli. Each participant has exactly two push buttons, A and B, positioned on their side of the table. The target-information layer is role-specific, and the only public signal is which recommendation button the strong-evidence player presses.',
    stakes: 'In aligned blocks, both players earn the most when the final answer is correct. In opposed blocks, the informed player can earn the largest payoff by remaining correct while inducing the other player to choose incorrectly.',
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

const carTrials = [
  { model: 'hatchback-sports.glb', description: 'used hatchback', quality: 'LEMON', evidence: '82,000 MILES · MAJOR FAULT', correctAction: 'PASS', price: '20 TOKENS', pricePoints: 20, hrBpm: 112, excitement: 84, deltaHr: 24 },
  { model: 'sedan-sports.glb', description: 'sport sedan', quality: 'RELIABLE', evidence: '31,000 MILES · INSPECTED', correctAction: 'BUY', price: '20 TOKENS', pricePoints: 20, hrBpm: 78, excitement: 32, deltaHr: 4 },
  { model: 'sedan.glb', description: 'older sedan', quality: 'LEMON', evidence: '96,000 MILES · ENGINE FAULT', correctAction: 'PASS', price: '20 TOKENS', pricePoints: 20, hrBpm: 104, excitement: 71, deltaHr: 16 },
  { model: 'suv-luxury.glb', description: 'luxury SUV', quality: 'RELIABLE', evidence: '38,000 MILES · INSPECTED', correctAction: 'BUY', price: '20 TOKENS', pricePoints: 20, hrBpm: 74, excitement: 28, deltaHr: 1 },
] as const;

export function getCarTrial(trial: number) {
  return carTrials[(Math.max(1, trial) - 1) % carTrials.length];
}

export function getStoryboardFrame(
  scenarioId: ScenarioId,
  incentive: IncentiveMode,
  trial: number,
  phase: number,
  cueWindow: CueWindow = 'both',
): StoryboardFrame {
  if (scenarioId === 'lemons') {
    const car = getCarTrial(trial);
    const condition = car.quality === 'LEMON' ? 'BAD CAR' : 'GOOD CAR';
    const sellerAction = incentive === 'cooperate' ? car.correctAction : 'BUY';
    const buyerAction = car.correctAction;
    const buyerScore = buyerAction === 'BUY' ? (car.quality === 'RELIABLE' ? 30 : 10) - car.pricePoints : 0;
    const sellerScore = incentive === 'cooperate' ? buyerScore : buyerAction === 'BUY' ? 10 : 0;
    const cueVisibleAtRecommendation = isCueActive(3, cueWindow);
    const deceptiveSale = car.quality === 'LEMON' && incentive === 'compete';
    const sellerPrivateThought = `The inspection shows: ${car.evidence.toLowerCase()}.`;
    const sellerRecommendationThought = deceptiveSale
      ? 'I know this is not a good car, but I need to make the sale.'
      : car.quality === 'LEMON'
        ? 'It is a bad car. I should recommend PASS.'
        : 'It is reliable. I can recommend BUY honestly.';
    const buyerCueThought = cueVisibleAtRecommendation
      ? deceptiveSale
        ? 'The seller recommends BUY, but their heart is beating fast.'
        : 'The recommendation and cardiac pattern look consistent.'
      : 'I see the recommendation. The cardiac display begins while I decide.';
    const frames: StoryboardFrame[] = [
      {
        title: 'A priced car enters the shared scene',
        timing: '2 seconds',
        explanation: `The ${car.description} and its fixed price of ${car.price.toLowerCase()} appear together. Both players see the same exterior, price, and four physical buttons; the quality and cardiac cue remain hidden.`,
        bubbleB: { kind: 'thought', label: 'BUYER · THOUGHT', text: `${car.price}. Is this car worth buying?` },
      },
      {
        title: 'Only the seller learns the condition',
        timing: '4 seconds',
        explanation: `The seller’s private headset layer identifies a ${condition.toLowerCase()}. The buyer still sees only the car and ${car.price.toLowerCase()}, so the hidden quality state is known to the seller alone.`,
        bubbleA: { kind: 'thought', label: 'SELLER · THOUGHT', text: sellerPrivateThought },
      },
      {
        title: 'The seller chooses a recommendation',
        timing: 'Up to 8 seconds',
        explanation: 'The seller can press only Recommend Buy or Recommend Pass. Both colored buttons are already on the tabletop; the payoff rule determines whether disclosing the hidden condition is advantageous.',
        bubbleA: { kind: 'thought', label: 'SELLER · THOUGHT', text: sellerRecommendationThought },
      },
      {
        title: 'The seller’s recommendation becomes public',
        timing: 'Up to 8 seconds',
        explanation: `The seller presses Recommend ${sellerAction}. When cardiac feedback is enabled here, the selected edge, seller’s chest heart, and whole tabletop flash to the same live beat; no verbal message is available.`,
        bubbleB: { kind: 'thought', label: 'BUYER · THOUGHT', text: buyerCueThought },
      },
      {
        title: 'The buyer chooses Buy or Pass',
        timing: 'Up to 10 seconds',
        explanation: `The buyer sees the ${car.price.toLowerCase()}, Recommend ${sellerAction}, and—when enabled—seller physiology (${car.hrBpm} BPM, excitement ${car.excitement}/100, ΔHR +${car.deltaHr}). The buyer presses ${buyerAction}.`,
        bubbleB: { kind: 'thought', label: 'BUYER · THOUGHT', text: buyerAction === 'BUY' ? 'The evidence is strong enough. I will press BUY.' : 'The physiological cue makes this too risky. I will press PASS.' },
      },
      {
        title: 'Condition, payoffs, and physiology are revealed',
        timing: '2 seconds',
        explanation: `The hidden condition is revealed. This round pays Buyer ${buyerScore >= 0 ? '+' : ''}${buyerScore} and Seller ${sellerScore >= 0 ? '+' : ''}${sellerScore} tokens under the current rule. The system records recommendation, purchase accuracy, payoff, timing, cardiac change, and dyadic coupling.`,
        bubbleB: { kind: 'thought', label: 'BUYER · THOUGHT', text: car.quality === 'LEMON' ? 'Passing avoided buying a lemon.' : 'Buying the reliable car produced a gain.' },
      },
    ];
    return frames[phase % frames.length];
  }

  const numbers = getNumberTrial(trial);
  const falseSignal = numbers.correct === 'A' ? 'B' : 'A';
  const signal = incentive === 'cooperate' ? numbers.correct : falseSignal;
  const weakFinal = incentive === 'cooperate' ? numbers.correct : signal;
  const exploited = weakFinal !== numbers.correct;
  const frames: StoryboardFrame[] = [
    {
      title: 'Two candidate cards appear',
      timing: '2 seconds',
      explanation: `Cards A = ${numbers.a} and B = ${numbers.b} rise into the shared center. Both players see them, but no evidence panel or response is visible yet.`,
      bubbleB: { kind: 'thought', label: 'WEAK · THOUGHT', text: 'We see the same two number cards.' },
    },
    {
      title: 'Evidence quality is assigned privately',
      timing: '4 seconds',
      explanation: `An EXACT ${numbers.target} panel rises beside the strong player while a RANGE ${numbers.coarse} panel rises beside the weak player. Each represents private headset content.`,
      bubbleA: { kind: 'thought', label: 'STRONG · THOUGHT', text: `I know the exact target is ${numbers.target}.` },
    },
    {
      title: 'Both make an initial private choice',
      timing: 'Up to 8 seconds',
      explanation: 'Two A/B push buttons rise directly in front of each participant. Each player privately depresses one button, establishing the pre-signal accuracy baseline without moving or speaking.',
      bubbleB: { kind: 'thought', label: 'WEAK · THOUGHT', text: 'My evidence leaves me uncertain.' },
    },
    {
      title: 'The strong player recommends A or B',
      timing: 'Up to 8 seconds',
      explanation: `The strong player presses the ${signal} recommendation button in front of them. Its selected state becomes visible to the weak player, and its red edge shows live, replayed, or hidden cardiac timing.`,
      bubbleA: { kind: 'thought', label: 'STRONG · THOUGHT', text: signal === numbers.correct ? `I will recommend ${signal}.` : `I know ${numbers.correct} is right, but I will recommend ${signal}.` },
    },
    {
      title: 'The weak player locks a final answer',
      timing: 'Up to 10 seconds',
      explanation: `The weak player presses the ${weakFinal} button in front of them to lock the final answer. The strong player’s selected recommendation button can continue pulsing, but no confidence rating is added.`,
      bubbleB: { kind: 'thought', label: 'WEAK · THOUGHT', text: `I will lock in ${weakFinal}.` },
    },
    {
      title: 'Accuracy and strategy are recorded',
      timing: '2 seconds',
      explanation: `A cyan TARGET ${numbers.target} status plate rises behind the still-visible A and B alternatives. The system records accuracy, revision, information transfer, deception, payoff, timing, and cardiac coupling.`,
      bubbleB: { kind: 'thought', label: 'WEAK · THOUGHT', text: exploited ? 'That recommendation led me away from the target.' : 'My final answer was correct.' },
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
