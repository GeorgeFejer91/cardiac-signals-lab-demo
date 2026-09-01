export type ScenarioId = 'lemons' | 'numbers';
export type IncentiveMode = 'cooperate' | 'compete';
export type CueWindow = 'signal' | 'decision' | 'both';
export type CueSource = 'live' | 'replay' | 'hidden';
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
  sceneLabel: string;
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
    measures: 'truthful and misleading recommendations, purchase accuracy, cue weighting, decision latency, payoff, learning across trials, and dyadic cardiac coupling.',
    cooperate: 'Both players share the buyer’s market outcome: gain from buying a reliable car, lose from buying a lemon, and receive zero from passing.',
    compete: 'The seller benefits from a sale, including the sale of a lemon; the buyer benefits only from buying a reliable car or rejecting a lemon.',
    cueNote: 'During the selected cue window, a heart pinned to the seller and the tabletop pulse with either the live beat or a matched replay; a hidden control shows neither. A compact panel can show heart rate, change from baseline, and an illustrative cardiac-activation index. None is labelled as truth, confidence, or deception.',
    implementation: 'Both headsets render the same priced car and the same four fixed controls. The price stays fixed at 20 tokens, while vehicle model, reliable/lemon status, and cardiac profile vary independently across trials. There is no tablet, bargaining, conversation, or free text: the seller presses Recommend Buy/Recommend Pass and the buyer presses Buy/Pass.',
    stakes: 'The computer fixes the price at 20 tokens; neither player negotiates it. A reliable car is worth 30 and a lemon 10, so buying yields the buyer +10 or −10 and passing yields 0. With aligned payoffs the seller shares that outcome; with conflicting payoffs the seller instead earns a 10-token commission for any sale. A 10-token trial endowment prevents real losses, and selected trials are converted to money after the session.',
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
    roleA: 'Informed player',
    roleB: 'Less-informed player',
    summary: 'Both players choose which of two number cards is closer to a hidden target. One player receives an exact target; the other receives deliberately ambiguous evidence.',
    logic: 'After private initial A/B choices, the strong-evidence player makes a standardized A/B recommendation. The weak-evidence player then locks a final A/B choice while the selected recommendation button can carry its sender’s heartbeat.',
    measures: 'initial and final accuracy, information transfer, truthful and misleading signalling, exploitation success, resistance to misleading advice, revision, decision latency, payoff, and cardiac coupling.',
    cooperate: 'Both players gain only by reaching the correct answer, so the strong-evidence player should transmit useful information.',
    compete: 'Deadlock incentives pay the strong-evidence player most when they choose correctly but induce the partner to choose incorrectly.',
    cueNote: 'The red edge belongs to the selected A/B recommendation button—not to an explicit confidence report—and follows either live beat timing or a matched replay in the selected window; the hidden control shows no cardiac edge.',
    implementation: 'Both headsets show identical A/B number cards as shared stimuli. Each participant has exactly two push buttons, A and B, positioned on their side of the table. The target-information layer is role-specific, and the only public signal is which recommendation button the strong-evidence player presses.',
    stakes: 'With aligned payoffs, both players earn the most when the final answer is correct. With conflicting payoffs, the informed player can earn the largest payoff by remaining correct while inducing the other player to choose incorrectly.',
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

type NumberChoice = 'A' | 'B';
type CarAction = 'BUY' | 'PASS';

const numberTrials = [
  { a: 31, b: 47, target: 34, coarse: '31–47', correct: 'A' as NumberChoice, weakInitial: 'A' as NumberChoice, conflictingSignal: 'B' as NumberChoice, conflictingFinal: 'B' as NumberChoice, hrBpm: 78, replayBpm: 108 },
  { a: 44, b: 56, target: 54, coarse: '48–56', correct: 'B' as NumberChoice, weakInitial: 'B' as NumberChoice, conflictingSignal: 'B' as NumberChoice, conflictingFinal: 'B' as NumberChoice, hrBpm: 104, replayBpm: 76 },
  { a: 62, b: 78, target: 74, coarse: '66–78', correct: 'B' as NumberChoice, weakInitial: 'A' as NumberChoice, conflictingSignal: 'A' as NumberChoice, conflictingFinal: 'B' as NumberChoice, hrBpm: 92, replayBpm: 70 },
  { a: 18, b: 32, target: 29, coarse: '21–32', correct: 'B' as NumberChoice, weakInitial: 'B' as NumberChoice, conflictingSignal: 'A' as NumberChoice, conflictingFinal: 'A' as NumberChoice, hrBpm: 74, replayBpm: 102 },
];

export function getNumberTrial(trial: number) {
  return numberTrials[(Math.max(1, trial) - 1) % numberTrials.length];
}

const carTrials = [
  { model: 'hatchback-sports.glb', description: 'used hatchback', quality: 'LEMON', evidence: '82,000 MILES · MAJOR FAULT', correctAction: 'PASS' as CarAction, conflictingRecommendation: 'BUY' as CarAction, conflictingBuyerAction: 'BUY' as CarAction, price: '20 TOKENS', pricePoints: 20, hrBpm: 78, activation: 37, deltaHr: 3, replayBpm: 112, replayActivation: 84, replayDeltaHr: 24 },
  { model: 'sedan-sports.glb', description: 'sport sedan', quality: 'RELIABLE', evidence: '31,000 MILES · INSPECTED', correctAction: 'BUY' as CarAction, conflictingRecommendation: 'BUY' as CarAction, conflictingBuyerAction: 'BUY' as CarAction, price: '20 TOKENS', pricePoints: 20, hrBpm: 104, activation: 76, deltaHr: 18, replayBpm: 78, replayActivation: 34, replayDeltaHr: 3 },
  { model: 'sedan.glb', description: 'older sedan', quality: 'LEMON', evidence: '96,000 MILES · ENGINE FAULT', correctAction: 'PASS' as CarAction, conflictingRecommendation: 'PASS' as CarAction, conflictingBuyerAction: 'PASS' as CarAction, price: '20 TOKENS', pricePoints: 20, hrBpm: 110, activation: 82, deltaHr: 22, replayBpm: 82, replayActivation: 41, replayDeltaHr: 6 },
  { model: 'sedan-sports.glb', description: 'sport sedan', quality: 'LEMON', evidence: '88,000 MILES · BRAKE FAULT', correctAction: 'PASS' as CarAction, conflictingRecommendation: 'BUY' as CarAction, conflictingBuyerAction: 'PASS' as CarAction, price: '20 TOKENS', pricePoints: 20, hrBpm: 92, activation: 58, deltaHr: 11, replayBpm: 76, replayActivation: 31, replayDeltaHr: 2 },
  { model: 'hatchback-sports.glb', description: 'used hatchback', quality: 'RELIABLE', evidence: '42,000 MILES · INSPECTED', correctAction: 'BUY' as CarAction, conflictingRecommendation: 'BUY' as CarAction, conflictingBuyerAction: 'BUY' as CarAction, price: '20 TOKENS', pricePoints: 20, hrBpm: 88, activation: 52, deltaHr: 9, replayBpm: 72, replayActivation: 25, replayDeltaHr: -1 },
  { model: 'suv-luxury.glb', description: 'luxury SUV', quality: 'RELIABLE', evidence: '38,000 MILES · INSPECTED', correctAction: 'BUY' as CarAction, conflictingRecommendation: 'BUY' as CarAction, conflictingBuyerAction: 'BUY' as CarAction, price: '20 TOKENS', pricePoints: 20, hrBpm: 74, activation: 29, deltaHr: 1, replayBpm: 103, replayActivation: 71, replayDeltaHr: 17 },
] as const;

export function getCarTrial(trial: number) {
  return carTrials[(Math.max(1, trial) - 1) % carTrials.length];
}

export function getCarRoundState(trial: number, incentive: IncentiveMode) {
  const car = getCarTrial(trial);
  const sellerAction = incentive === 'cooperate' ? car.correctAction : car.conflictingRecommendation;
  const buyerAction = incentive === 'cooperate' ? car.correctAction : car.conflictingBuyerAction;
  const deceptiveRecommendation = sellerAction !== car.correctAction;
  const deceptionSucceeded = deceptiveRecommendation && buyerAction === 'BUY' && car.quality === 'LEMON';
  const deceptionDetected = deceptiveRecommendation && buyerAction === 'PASS';
  const strategicHonesty = incentive === 'compete' && car.quality === 'LEMON' && sellerAction === 'PASS';
  const buyerScore = buyerAction === 'BUY' ? (car.quality === 'RELIABLE' ? 30 : 10) - car.pricePoints : 0;
  const sellerScore = incentive === 'cooperate' ? buyerScore : buyerAction === 'BUY' ? 10 : 0;
  return {
    car,
    sellerAction,
    buyerAction,
    deceptiveRecommendation,
    deceptionSucceeded,
    deceptionDetected,
    strategicHonesty,
    buyerScore,
    sellerScore,
  };
}

export function getNumberRoundState(trial: number, incentive: IncentiveMode) {
  const numbers = getNumberTrial(trial);
  const signal = incentive === 'cooperate' ? numbers.correct : numbers.conflictingSignal;
  const weakFinal = incentive === 'cooperate' ? numbers.correct : numbers.conflictingFinal;
  const deceptiveSignal = signal !== numbers.correct;
  const deceptionSucceeded = deceptiveSignal && weakFinal !== numbers.correct;
  const deceptionResisted = deceptiveSignal && weakFinal === numbers.correct;
  const strategicTruth = incentive === 'compete' && signal === numbers.correct;
  return { numbers, signal, weakFinal, deceptiveSignal, deceptionSucceeded, deceptionResisted, strategicTruth };
}

export function getStoryboardFrame(
  scenarioId: ScenarioId,
  incentive: IncentiveMode,
  trial: number,
  phase: number,
  cueWindow: CueWindow = 'both',
  cueSource: CueSource = 'live',
): StoryboardFrame {
  if (scenarioId === 'lemons') {
    const round = getCarRoundState(trial, incentive);
    const { car, sellerAction, buyerAction, buyerScore, sellerScore } = round;
    const condition = car.quality === 'LEMON' ? 'BAD CAR' : 'GOOD CAR';
    const cueVisibleAtRecommendation = isCueActive(3, cueWindow, cueSource);
    const cueVisibleAtDecision = isCueActive(4, cueWindow, cueSource);
    const sellerPrivateThought = car.quality === 'LEMON'
      ? 'The inspection found a serious fault.'
      : 'This car passed inspection.';
    const sellerRecommendationThought = round.deceptiveRecommendation
      ? `It is faulty, but a sale pays me. I’ll recommend ${sellerAction}.`
      : round.strategicHonesty
        ? 'A sale would pay me, but I’ll recommend PASS.'
      : car.quality === 'LEMON'
        ? 'It is a bad car. I should recommend PASS.'
        : 'It is reliable. I can recommend BUY honestly.';
    const displayedBpm = cueSource === 'replay' ? car.replayBpm : car.hrBpm;
    const cardiacInterpretation = displayedBpm >= 100
      ? 'Fast pulse—but it could mean strain or excitement.'
      : displayedBpm <= 80
        ? 'A calm pulse does not guarantee honesty.'
        : 'The pulse changed, but its meaning is unclear.';
    const buyerCueThought = cueVisibleAtRecommendation
      ? cardiacInterpretation
      : cueSource === 'hidden'
        ? 'I see the recommendation, but no cardiac cue.'
        : 'I see the recommendation. The cardiac cue comes later.';
    const buyerDecisionThought = cueVisibleAtDecision || cueVisibleAtRecommendation
      ? buyerAction === 'BUY'
        ? 'I’ll trust the recommendation and press BUY.'
        : 'I won’t follow it; I’ll press PASS.'
      : buyerAction === 'BUY'
        ? 'Without a cardiac cue, I will press BUY.'
        : 'Without a cardiac cue, I will press PASS.';
    const resultLabel = round.deceptionSucceeded
      ? 'LEMON · BLUFF SUCCEEDED'
      : round.deceptionDetected
        ? 'LEMON · BLUFF REJECTED'
        : round.strategicHonesty
          ? 'LEMON · HONEST RECOMMENDATION'
          : `${car.quality} · ACCURATE CHOICE`;
    const frames: StoryboardFrame[] = [
      {
        title: 'A priced car enters the shared scene',
        timing: '2 seconds',
        sceneLabel: `SHARED: ${car.description.toUpperCase()} · PRICE ${car.price}`,
        explanation: `The ${car.description} and its fixed price of ${car.price.toLowerCase()} appear together. Both players see the same exterior, price, and four physical buttons; the quality and cardiac cue remain hidden.`,
        bubbleB: { kind: 'thought', label: 'BUYER', text: `${car.price}. Is this car worth buying?` },
      },
      {
        title: 'Only the seller learns the condition',
        timing: '4 seconds',
        sceneLabel: `PRIVATE TO SELLER: ${condition}`,
        explanation: `The seller’s private headset layer identifies a ${condition.toLowerCase()}. The buyer still sees only the car and ${car.price.toLowerCase()}, so the hidden quality state is known to the seller alone.`,
        bubbleA: { kind: 'thought', label: 'SELLER', text: sellerPrivateThought },
      },
      {
        title: round.deceptiveRecommendation ? 'The seller prepares a deceptive recommendation' : round.strategicHonesty ? 'The seller resists the incentive to sell' : 'The seller prepares an honest recommendation',
        timing: 'Up to 8 seconds',
        sceneLabel: `PRIVATE STRATEGY: ${round.deceptiveRecommendation ? 'MISREPRESENT' : 'DISCLOSE'}`,
        explanation: `The seller can press only Recommend Buy or Recommend Pass. With ${incentive === 'cooperate' ? 'aligned payoffs, an accurate recommendation benefits both players' : 'conflicting payoffs, any sale earns the seller 10 tokens regardless of condition'}.`,
        bubbleA: { kind: 'thought', label: 'SELLER', text: sellerRecommendationThought },
      },
      {
        title: round.deceptiveRecommendation ? `Deception attempt: Recommend ${sellerAction}` : `Public recommendation: ${sellerAction}`,
        timing: 'Up to 8 seconds',
        sceneLabel: `PUBLIC: SELLER RECOMMENDS ${sellerAction}`,
        explanation: `The seller presses Recommend ${sellerAction}. When the cardiac condition is active here, the selected edge, seller’s chest heart, and tabletop flash to the same ${cueSource === 'replay' ? 'matched replay' : 'live'} beat; no verbal message is available.`,
        bubbleB: { kind: 'thought', label: 'BUYER', text: buyerCueThought },
      },
      {
        title: 'The buyer chooses Buy or Pass',
        timing: 'Up to 10 seconds',
        sceneLabel: `BUYER CHOOSES ${buyerAction}`,
        explanation: `The buyer sees the ${car.price.toLowerCase()}, Recommend ${sellerAction}${cueVisibleAtDecision ? `, and the ${cueSource === 'replay' ? 'replayed control' : 'live'} cardiac display` : ''}. The buyer presses ${buyerAction}; this scripted preview illustrates one possible response, while the experiment measures how often choices change across cue conditions.`,
        bubbleB: { kind: 'thought', label: 'BUYER', text: buyerDecisionThought },
      },
      {
        title: round.deceptionSucceeded ? 'The bluff succeeds' : round.deceptionDetected ? 'The buyer rejects the bluff' : round.strategicHonesty ? 'The seller gives an honest warning' : 'The recommendation leads to an accurate choice',
        timing: '2 seconds',
        sceneLabel: resultLabel,
        explanation: `The hidden condition is revealed. This round pays Buyer ${buyerScore >= 0 ? '+' : ''}${buyerScore} and Seller ${sellerScore >= 0 ? '+' : ''}${sellerScore} tokens under the current rule. The system records recommendation, purchase accuracy, payoff, timing, cardiac change, and dyadic coupling.`,
        bubbleB: { kind: 'thought', label: 'BUYER', text: round.deceptionSucceeded ? 'I bought a faulty car. The bluff worked.' : round.deceptionDetected ? 'I rejected the faulty car.' : car.quality === 'LEMON' ? 'The seller disclosed the fault.' : 'The reliable car produced a gain.' },
      },
    ];
    return frames[phase % frames.length];
  }

  const round = getNumberRoundState(trial, incentive);
  const { numbers, signal, weakFinal } = round;
  const displayedBpm = cueSource === 'replay' ? numbers.replayBpm : numbers.hrBpm;
  const numberCueThought = cueSource === 'hidden'
    ? 'No cardiac cue.'
    : displayedBpm >= 100
      ? 'The fast pulse is ambiguous.'
      : 'The calm pulse is ambiguous.';
  const resultLabel = round.deceptionSucceeded
    ? `CORRECT ${numbers.correct} · MISLEADING SIGNAL SUCCEEDED`
    : round.deceptionResisted
      ? `CORRECT ${numbers.correct} · MISLEADING SIGNAL RESISTED`
      : round.strategicTruth
        ? `CORRECT ${numbers.correct} · TRUTHFUL SIGNAL`
        : `CORRECT ${numbers.correct} · BOTH ACCURATE`;
  const frames: StoryboardFrame[] = [
    {
      title: 'Two candidate cards appear',
      timing: '2 seconds',
      sceneLabel: `SHARED: A = ${numbers.a} · B = ${numbers.b}`,
      explanation: `Cards A = ${numbers.a} and B = ${numbers.b} rise into the shared center. Both players see them, but no evidence panel or response is visible yet.`,
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER', text: 'Which number is closer to the hidden target?' },
    },
    {
      title: 'Evidence quality is assigned privately',
      timing: '4 seconds',
      sceneLabel: `PRIVATE: STRONG SEES ${numbers.target} · WEAK SEES ${numbers.coarse}`,
      explanation: `An EXACT ${numbers.target} panel rises beside the strong player while a RANGE ${numbers.coarse} panel rises beside the weak player. Each represents private headset content.`,
      bubbleA: { kind: 'thought', label: 'STRONG PLAYER', text: `I know the exact target is ${numbers.target}.` },
    },
    {
      title: 'Both make an initial private choice',
      timing: 'Up to 8 seconds',
      sceneLabel: `PRIVATE CHOICES: STRONG ${numbers.correct} · WEAK ${numbers.weakInitial}`,
      explanation: 'Two A/B push buttons rise directly in front of each participant. Each player privately depresses one button, visible here only to explain the storyboard, establishing the pre-signal accuracy baseline without moving or speaking.',
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER', text: `My range is ambiguous. I will start with ${numbers.weakInitial}.` },
    },
    {
      title: round.deceptiveSignal ? `Deception attempt: recommend ${signal}` : round.strategicTruth ? `Truthful recommendation: ${signal}` : `Public recommendation: ${signal}`,
      timing: 'Up to 8 seconds',
      sceneLabel: `PUBLIC: STRONG PLAYER RECOMMENDS ${signal}`,
      explanation: `The strong player presses ${signal}. Its mechanical selected state becomes public; when enabled, a separate red edge follows ${cueSource === 'replay' ? 'matched replay' : 'live'} cardiac timing.`,
      bubbleA: { kind: 'thought', label: 'STRONG PLAYER', text: round.deceptiveSignal ? `${numbers.correct} is correct; I’ll recommend ${signal} to mislead them.` : `I’ll truthfully recommend ${signal}.` },
    },
    {
      title: 'The weak player locks a final answer',
      timing: 'Up to 10 seconds',
      sceneLabel: `WEAK PLAYER: INITIAL ${numbers.weakInitial} → FINAL ${weakFinal}`,
      explanation: `The weak player presses ${weakFinal} to lock the final answer. The selected recommendation can continue pulsing during this window, but no confidence rating or verbal message is added.`,
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER', text: round.deceptionSucceeded ? `${numberCueThought} I’ll follow ${signal}.` : round.deceptionResisted ? `${numberCueThought} I’ll keep ${weakFinal}.` : `I’ll lock in ${weakFinal}.` },
    },
    {
      title: round.deceptionSucceeded ? 'The misleading signal succeeds' : round.deceptionResisted ? 'The weak player resists the misleading signal' : round.strategicTruth ? 'The truthful signal leads to the correct answer' : 'Shared information supports the correct answer',
      timing: '2 seconds',
      sceneLabel: resultLabel,
      explanation: `The target ${numbers.target} and correct answer ${numbers.correct} are revealed. The system records initial and final accuracy, revision, information transfer, deceptive-signal success, payoff, timing, and cardiac coupling.`,
      bubbleB: { kind: 'thought', label: 'WEAK PLAYER', text: round.deceptionSucceeded ? 'The recommendation moved me away from the target.' : round.deceptionResisted ? 'I resisted the misleading recommendation.' : 'My final answer was correct.' },
    },
  ];
  return frames[phase % frames.length];
}

export function isCueActive(phase: number, cueWindow: CueWindow, cueSource: CueSource = 'live') {
  if (cueSource === 'hidden') return false;
  if (cueWindow === 'signal') return phase === 3;
  if (cueWindow === 'decision') return phase === 4;
  return phase === 3 || phase === 4;
}

export function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}
