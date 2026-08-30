export type ScenarioId = 'signal' | 'dilemma' | 'concealed' | 'ultimatum';
export type IncentiveMode = 'cooperate' | 'compete';
export type FaceEmotion = 'neutral' | 'happiness' | 'sadness' | 'fear' | 'anger' | 'surprise';

export type ScenarioDefinition = {
  id: ScenarioId;
  title: string;
  summary: string;
  logic: string;
  measures: string;
  phases: [string, string, string, string, string];
  cooperate: string;
  compete: string;
  expressionsA: [FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion];
  expressionsB: [FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion];
};

export const scenarios: ScenarioDefinition[] = [
  {
    id: 'signal',
    title: 'Hidden Target',
    summary: 'A knows the target; B must infer it from A’s card and visible heartbeat cue.',
    logic: 'Asymmetric information: A knows the correct card and B combines A’s card choice with the heartbeat cue.',
    measures: 'Target accuracy, decision time, cue use, payoff, and cardiac coupling.',
    phases: ['Private target', 'Signal card', 'Heartbeat cue', 'Receiver choice', 'Reveal'],
    cooperate: 'Both players score when B finds the target.',
    compete: 'A scores by concealing the target; B scores by finding it.',
    expressionsA: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'surprise', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'dilemma',
    title: 'Share / Keep',
    summary: 'Both players privately choose Share or Keep, then reveal together.',
    logic: 'A repeated social dilemma: each payoff depends on the two cards revealed together.',
    measures: 'Cooperation, reciprocity, switching, decision time, payoff, and cardiac coupling.',
    phases: ['Private choice', 'Cards locked', 'Heartbeat cue', 'Joint reveal', 'Payoff'],
    cooperate: 'The largest joint payoff follows mutual Share.',
    compete: 'Keep can exploit a partner who chose Share.',
    expressionsA: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'concealed',
    title: 'Concealed Card',
    summary: 'A recognizes one secret card; B tries to detect which card A knows.',
    logic: 'Concealed recognition: only one candidate is meaningful to A, while B searches for a card-specific cardiac change.',
    measures: 'Detection accuracy, response time, probe-related cardiac change, and concealment success.',
    phases: ['Memorize card', 'Candidate cards', 'Heartbeat cue', 'Observer choice', 'Reveal'],
    cooperate: 'Both players score when B identifies the remembered card.',
    compete: 'A scores by concealing it; B scores by detecting it.',
    expressionsA: ['neutral', 'neutral', 'fear', 'neutral', 'sadness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'ultimatum',
    title: 'Offer / Response',
    summary: 'A divides ten tokens; B accepts the split or rejects it for both players.',
    logic: 'Sequential bargaining: A chooses a split and B decides whether that split is implemented.',
    measures: 'Offer size, acceptance, costly rejection, response time, payoff, and cardiac coupling.',
    phases: ['Prepare offer', 'Offer card', 'Heartbeat cue', 'Accept / reject', 'Payout'],
    cooperate: 'A balanced accepted offer benefits both players.',
    compete: 'A can demand more, while B can punish the offer by rejecting it.',
    expressionsA: ['neutral', 'neutral', 'fear', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'surprise', 'surprise', 'anger', 'happiness'],
  },
];

export function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}
