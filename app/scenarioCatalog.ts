export type ScenarioId = 'signal' | 'dilemma' | 'concealed' | 'ultimatum';
export type IncentiveMode = 'cooperate' | 'compete';
export type FaceEmotion = 'neutral' | 'happiness' | 'sadness' | 'fear' | 'anger' | 'surprise';

export type ScenarioPublication = {
  authors: string;
  year: number;
  title: string;
  venue: string;
  href: string;
  relevance: string;
};

export type ScenarioDefinition = {
  id: ScenarioId;
  title: string;
  summary: string;
  logic: string;
  measures: string;
  phases: [string, string, string, string, string];
  speechA: [string, string, string, string, string];
  speechB: [string, string, string, string, string];
  speechACompete: [string, string, string, string, string];
  speechBCompete: [string, string, string, string, string];
  cooperate: string;
  compete: string;
  publications: ScenarioPublication[];
  expressionsA: [FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion];
  expressionsB: [FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion];
};

export const scenarios: ScenarioDefinition[] = [
  {
    id: 'signal',
    title: 'Joint Discrimination Task',
    summary: 'Both players judge whether A or B is closer in size to a private target; one player receives stronger evidence.',
    logic: 'The card adaptation makes the better-informed player’s A/B suggestion—and its cardiac cue—visible before the less-informed player decides.',
    measures: 'Target accuracy, decision time, cue use, payoff, and cardiac coupling.',
    phases: ['Private target', 'Signal card', 'Heartbeat cue', 'Receiver choice', 'Reveal'],
    speechA: ['A is closer to my target.', 'I signal A.', 'My card shows my pulse.', 'I wait for your choice.', 'A was correct.'],
    speechB: ['My target is ambiguous.', 'I watch your A/B card.', 'I can use the pulse.', 'I choose A.', 'We chose correctly.'],
    speechACompete: ['A is closer to my target.', 'I signal B.', 'My card shows my pulse.', 'Will you detect the bluff?', 'I secretly chose A.'],
    speechBCompete: ['My target is ambiguous.', 'Is B misleading?', 'The pulse may help me.', 'I still choose A.', 'I resisted the signal.'],
    cooperate: 'Common-interest payoffs reward both players for selecting the correct alternative.',
    compete: 'Deadlock-game payoffs let the better-informed player gain more by misleading the less-informed player.',
    publications: [
      {
        authors: 'Pulford, Mangiarulo & Colman',
        year: 2025,
        title: 'Confidence signalling aids deception in strategic interactions',
        venue: 'Scientific Reports',
        href: 'https://doi.org/10.1038/s41598-025-00279-w',
        relevance: 'Original asymmetric-information size-judgment task with Deadlock-game incentives.',
      },
      {
        authors: 'Pulford, Colman, Buabang & Krockow',
        year: 2018,
        title: 'The persuasive power of knowledge: Testing the confidence heuristic',
        venue: 'Journal of Experimental Psychology: General',
        href: 'https://doi.org/10.1037/xge0000471',
        relevance: 'Common-interest precursor using dyadic discrimination and unequal evidence quality.',
      },
      {
        authors: 'Thomas & McFadyen',
        year: 1995,
        title: 'The confidence heuristic: A game-theoretic analysis',
        venue: 'Journal of Economic Psychology',
        href: 'https://doi.org/10.1016/0167-4870(94)00032-6',
        relevance: 'Foundational model of confidence signalling under asymmetric information.',
      },
    ],
    expressionsA: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'surprise', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'dilemma',
    title: 'Iterated Prisoner’s Dilemma',
    summary: 'Both players privately choose Cooperate or Defect, reveal simultaneously, and repeat the interaction.',
    logic: 'Mutual cooperation benefits both players, but unilateral defection can produce the largest individual payoff.',
    measures: 'Cooperation, reciprocity, switching, decision time, payoff, and cardiac coupling.',
    phases: ['Private choice', 'Cards locked', 'Heartbeat cue', 'Joint reveal', 'Payoff'],
    speechA: ['I choose privately.', 'My card is locked.', 'My card shows my pulse.', 'We reveal together.', 'We both cooperated.'],
    speechB: ['I choose privately.', 'My card is locked.', 'I can see your pulse.', 'We reveal together.', 'I will adapt next round.'],
    speechACompete: ['I choose DEFECT.', 'My card is locked.', 'My card shows my pulse.', 'I reveal DEFECT.', 'I gain while you cooperated.'],
    speechBCompete: ['I choose COOPERATE.', 'My card is locked.', 'Can I predict your choice?', 'I reveal COOPERATE.', 'You defected against me.'],
    cooperate: 'The cooperative demonstration shows mutual cooperation and its shared payoff.',
    compete: 'The mixed-motive demonstration shows unilateral defection exploiting a cooperative partner.',
    publications: [
      {
        authors: 'Merrill & Cheshire',
        year: 2017,
        title: 'Trust Your Heart: Assessing Cooperation and Trust with Biosignals in Computer-Mediated Interactions',
        venue: 'ACM CSCW',
        href: 'https://doi.org/10.1145/2998181.2998286',
        relevance: 'Directly manipulated visibility of a partner’s heart rate in a social-dilemma game.',
      },
      {
        authors: 'Behrens et al.',
        year: 2020,
        title: 'Physiological synchrony is associated with cooperative success in real-life interactions',
        venue: 'Scientific Reports',
        href: 'https://doi.org/10.1038/s41598-020-76539-8',
        relevance: 'Measured cardiac and electrodermal synchrony during face-to-face Prisoner’s Dilemma play.',
      },
      {
        authors: 'Jahng et al.',
        year: 2017,
        title: 'Neural dynamics of two players when using nonverbal cues to gauge intentions to cooperate during the Prisoner’s Dilemma Game',
        venue: 'NeuroImage',
        href: 'https://doi.org/10.1016/j.neuroimage.2017.06.024',
        relevance: 'Hyperscanning evidence for nonverbal cue use during iterated dyadic decisions.',
      },
    ],
    expressionsA: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'concealed',
    title: 'Concealed Information Test',
    summary: 'A recognizes one secret card; B tries to detect which card A knows.',
    logic: 'Concealed recognition: only one candidate is meaningful to A, while B searches for a card-specific cardiac change.',
    measures: 'Detection accuracy, response time, probe-related cardiac change, and concealment success.',
    phases: ['Memorize card', 'Candidate cards', 'Heartbeat cue', 'Observer choice', 'Reveal'],
    speechA: ['I memorize the 4♦.', 'I view every card.', 'I try not to react.', 'I stay silent.', 'The secret was 4♦.'],
    speechB: ['I do not know the card.', 'I inspect each candidate.', 'Did the pulse change?', 'I choose 4♦.', 'My detection is recorded.'],
    speechACompete: ['I memorize the 4♦.', 'I conceal recognition.', 'I try to suppress the cue.', 'I stay silent.', 'Did I hide it?'],
    speechBCompete: ['I do not know the card.', 'I search for your reaction.', 'Did the pulse change?', 'I choose 4♦.', 'Detection is scored.'],
    cooperate: 'Both players score when B identifies the remembered card.',
    compete: 'A scores by concealing it; B scores by detecting it.',
    publications: [
      {
        authors: 'klein Selle et al.',
        year: 2019,
        title: 'Hide or Seek? Physiological Responses Reflect Both the Decision and the Attempt to Conceal Information',
        venue: 'Psychological Science',
        href: 'https://doi.org/10.1177/0956797619864598',
        relevance: 'Separates anticipatory concealment decisions from physiological responses during concealment.',
      },
      {
        authors: 'Meijer et al.',
        year: 2014,
        title: 'Memory detection with the Concealed Information Test: A meta-analysis of skin conductance, respiration, heart rate, and P300 data',
        venue: 'Psychophysiology',
        href: 'https://doi.org/10.1111/psyp.12239',
        relevance: 'Quantifies the evidence base for heart-rate and other psychophysiological CIT effects.',
      },
      {
        authors: 'Zaitsu',
        year: 2016,
        title: 'External validity of Concealed Information Test experiment: Comparison of respiration, skin conductance, and heart rate between experimental and field card tests',
        venue: 'Psychophysiology',
        href: 'https://doi.org/10.1111/psyp.12650',
        relevance: 'Especially relevant validation using card tests and heart-rate deceleration.',
      },
    ],
    expressionsA: ['neutral', 'neutral', 'fear', 'neutral', 'sadness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'ultimatum',
    title: 'Ultimatum Game',
    summary: 'A divides ten tokens; B accepts the split or rejects it for both players.',
    logic: 'Sequential bargaining: A chooses a split and B decides whether that split is implemented.',
    measures: 'Offer size, acceptance, costly rejection, response time, payoff, and cardiac coupling.',
    phases: ['Prepare offer', 'Offer card', 'Heartbeat cue', 'Accept / reject', 'Payout'],
    speechA: ['I divide ten tokens.', 'I offer 7 / 3.', 'My offer shows my pulse.', 'I wait for your answer.', 'The split is applied.'],
    speechB: ['I wait for the offer.', 'I inspect the split.', 'I can see your pulse.', 'I choose ACCEPT.', 'I receive seven.'],
    speechACompete: ['I try to keep more.', 'I offer B3 / A7.', 'My offer shows my pulse.', 'Will you accept?', 'The offer was rejected.'],
    speechBCompete: ['I wait for the offer.', 'This split favors A.', 'I can see your pulse.', 'I choose REJECT.', 'We both receive zero.'],
    cooperate: 'A balanced accepted offer benefits both players.',
    compete: 'A can demand more, while B can punish the offer by rejecting it.',
    publications: [
      {
        authors: 'Osumi & Ohira',
        year: 2009,
        title: 'Cardiac responses predict decisions: An investigation of the relation between orienting response and decisions in the ultimatum game',
        venue: 'International Journal of Psychophysiology',
        href: 'https://doi.org/10.1016/j.ijpsycho.2009.07.007',
        relevance: 'Links phasic cardiac deceleration to offers that responders subsequently reject.',
      },
      {
        authors: 'Osumi & Ohira',
        year: 2016,
        title: 'Heart-rate deceleration predicting the determination of costly punishment',
        venue: 'International Journal of Psychophysiology',
        href: 'https://doi.org/10.1016/j.ijpsycho.2016.09.017',
        relevance: 'Qualifies cardiac deceleration as a marker of effort or conflict in costly punishment.',
      },
      {
        authors: 'Dulleck, Schaffner & Torgler',
        year: 2014,
        title: 'Heartbeat and Economic Decisions: Observing Mental Stress among Proposers and Responders in the Ultimatum Bargaining Game',
        venue: 'PLOS ONE',
        href: 'https://doi.org/10.1371/journal.pone.0108218',
        relevance: 'Records cardiovascular dynamics from both proposer and responder roles.',
      },
    ],
    expressionsA: ['neutral', 'neutral', 'fear', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'surprise', 'surprise', 'anger', 'happiness'],
  },
];

export function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}
