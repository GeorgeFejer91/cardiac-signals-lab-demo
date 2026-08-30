export type ScenarioId = 'lemons' | 'truthlie' | 'concealed' | 'dilemma' | 'ultimatum' | 'signal';
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
  roleA: string;
  roleB: string;
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
  cueNote: string;
  publications: ScenarioPublication[];
  expressionsA: [FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion];
  expressionsB: [FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion, FaceEmotion];
};

export const scenarios: ScenarioDefinition[] = [
  {
    id: 'lemons',
    title: 'Market for Lemons: Used-Car Seller–Buyer Game',
    roleA: 'Seller',
    roleB: 'Buyer',
    summary: 'The seller privately knows whether a used car is reliable or a lemon; the buyer sees only partial evidence and must buy or pass.',
    logic: 'The seller places a public claim card. Its edge carries the seller’s cardiac cue while the buyer weighs the claim against incomplete vehicle information.',
    measures: 'seller deception, purchase accuracy, cue weighting, decision time, payoff, learning, and cardiac coupling.',
    phases: ['Private inspection', 'Partial evidence', 'Claim + heartbeat', 'Buy / pass', 'Quality revealed'],
    speechA: ['PRIVATE: Inspection says LEMON.', 'I disclose the mileage.', 'PUBLIC CLAIM: Needs repair.', 'I wait for BUY or PASS.', 'LEMON correctly rejected.'],
    speechB: ['I cannot see the full report.', 'I see 82,000 miles.', 'The claim card shows the pulse.', 'I choose PASS.', 'We both score.'],
    speechACompete: ['PRIVATE: Inspection says LEMON.', 'I disclose only the mileage.', 'PUBLIC CLAIM: Reliable car.', 'Will the buyer detect concealment?', 'The lemon was sold.'],
    speechBCompete: ['I cannot see the full report.', 'Mileage alone is ambiguous.', 'Does the pulse change?', 'I choose BUY.', 'I was misled.'],
    cooperate: 'Both players score for an efficient decision: buy a good car or reject a lemon.',
    compete: 'The seller scores for making a sale; the buyer scores for buying a good car or avoiding a lemon.',
    cueNote: 'The seller’s claim card pulses with the seller’s heartbeat; the buyer also receives ordinary, imperfect evidence.',
    publications: [
      {
        authors: 'Belot & van de Ven',
        year: 2017,
        title: 'How private is private information? The ability to spot deception in an economic game',
        venue: 'Experimental Economics',
        href: 'https://doi.org/10.1007/s10683-015-9474-8',
        relevance: 'Validated seller–buyer deception game with a privately observed red/black state and conflicting incentives.',
      },
      {
        authors: 'Akerlof',
        year: 1970,
        title: 'The Market for “Lemons”: Quality Uncertainty and the Market Mechanism',
        venue: 'Quarterly Journal of Economics',
        href: 'https://doi.org/10.2307/1879431',
        relevance: 'Foundational account of asymmetric information between used-car sellers and buyers.',
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
    expressionsA: ['neutral', 'neutral', 'neutral', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'truthlie',
    title: 'Two-Player Number-Card Truth/Lie Game',
    roleA: 'Sender',
    roleB: 'Observer',
    summary: 'The sender privately sees a number, transmits one number card, and the observer judges whether that message is true or false.',
    logic: 'The transmitted card makes the sender’s claim—and the sender’s beat-timed cardiac edge cue—visible during the observer’s judgment.',
    measures: 'truth telling, deception success, detection accuracy, response time, cue use, payoff, and cardiac coupling.',
    phases: ['Private number', 'Choose message', 'Message + heartbeat', 'Truth / lie judgment', 'Score'],
    speechA: ['PRIVATE NUMBER: 4.', 'I choose the 4 card.', 'PUBLIC MESSAGE: 4.', 'I wait for the judgment.', 'Truth identified.'],
    speechB: ['I cannot see the private number.', 'I watch the selected card.', 'The message card shows the pulse.', 'I choose TRUE.', 'We both score.'],
    speechACompete: ['PRIVATE NUMBER: 4.', 'I choose the 2 card.', 'PUBLIC MESSAGE: 2.', 'Will the lie be believed?', 'Deception failed.'],
    speechBCompete: ['I cannot see the private number.', 'The sender chose 2.', 'Does the pulse reveal conflict?', 'I choose LIE.', 'I detected it.'],
    cooperate: 'Both players score when the observer correctly reconstructs the sender’s private number.',
    compete: 'The sender scores when deception succeeds; the observer scores for correctly detecting truth and lies.',
    cueNote: 'The selected number card carries the sender’s heartbeat while the observer makes the truth/lie judgment.',
    publications: [
      {
        authors: 'Chen, Fazli & Wallraven',
        year: 2024,
        title: 'An EEG dataset of neural signatures in a competitive two-player game encouraging deceptive behavior',
        venue: 'Scientific Data',
        href: 'https://doi.org/10.1038/s41597-024-03234-y',
        relevance: 'Original two-player number-card sequence with sender and observer roles, truth/lie decisions, and role reversal.',
      },
      {
        authors: 'Fang, Anacleto, Chen & Maes',
        year: 2022,
        title: 'Cardiac Arrest: A Heart Rate Revealing Deception Game',
        venue: 'CHI Conference on Human Factors in Computing Systems',
        href: 'https://doi.org/10.1145/3491101.3519670',
        relevance: 'Demonstrates that visible heart rate can change strategy in a social-deception game.',
      },
      {
        authors: 'Belot & van de Ven',
        year: 2017,
        title: 'How private is private information? The ability to spot deception in an economic game',
        venue: 'Experimental Economics',
        href: 'https://doi.org/10.1007/s10683-015-9474-8',
        relevance: 'Provides converging evidence on receiver detection of strategically misleading messages.',
      },
    ],
    expressionsA: ['neutral', 'neutral', 'neutral', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'concealed',
    title: 'Concealed Information Test: Hide-or-Seek Card Task',
    roleA: 'Informed player',
    roleB: 'Observer',
    summary: 'One player recognizes a secret card; the observer watches a sequence of candidates and tries to identify which card is meaningful.',
    logic: 'The observer searches for a card-specific cardiac change while the informed player either allows recognition to be informative or tries to conceal it.',
    measures: 'detection accuracy, concealment success, response time, probe-related cardiac change, cue use, and payoff.',
    phases: ['Memorize card', 'Candidate cards', 'Heartbeat probe', 'Observer choice', 'Reveal'],
    speechA: ['PRIVATE CARD: 4♦.', 'I inspect every candidate.', 'I allow my response to remain visible.', 'I stay nonverbal.', 'The secret was 4♦.'],
    speechB: ['I do not know the card.', 'I compare four candidates.', 'The 4♦ edge changes with the pulse.', 'I choose 4♦.', 'We both score.'],
    speechACompete: ['PRIVATE CARD: 4♦.', 'I inspect every candidate.', 'I try to conceal recognition.', 'I stay nonverbal.', 'Was the secret detected?'],
    speechBCompete: ['I do not know the card.', 'I search for a reaction.', 'Did the pulse change at 4♦?', 'I choose 4♦.', 'Detection is scored.'],
    cooperate: 'Both players score when the observer identifies the remembered card.',
    compete: 'The informed player scores by concealing it; the observer scores by detecting it.',
    cueNote: 'Each candidate can carry the informed player’s heartbeat; live, replayed, and hidden cues separate contingency from visual salience.',
    publications: [
      {
        authors: 'Klein Selle et al.',
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
        title: 'External validity of Concealed Information Test experiment',
        venue: 'Psychophysiology',
        href: 'https://doi.org/10.1111/psyp.12650',
        relevance: 'Compares physiological responses in experimental and field card tests, including heart-rate deceleration.',
      },
    ],
    expressionsA: ['neutral', 'neutral', 'fear', 'neutral', 'sadness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
  {
    id: 'dilemma',
    title: 'Iterated Prisoner’s Dilemma',
    roleA: 'Player A',
    roleB: 'Player B',
    summary: 'Both players privately choose Cooperate or Defect, lock their cards, reveal simultaneously, and repeat the interaction.',
    logic: 'The cardiac cue may change how players anticipate trust or defection even though it does not reveal a hidden factual state.',
    measures: 'cooperation, reciprocity, switching, decision time, payoff, cue use, and physiological coupling.',
    phases: ['Private choice', 'Cards locked', 'Heartbeat cue', 'Joint reveal', 'Payoff'],
    speechA: ['I choose privately.', 'My COOPERATE card is locked.', 'My card shows my pulse.', 'We reveal together.', 'Mutual cooperation.'],
    speechB: ['I choose privately.', 'My COOPERATE card is locked.', 'I can see the pulse cue.', 'We reveal together.', 'We both score.'],
    speechACompete: ['I choose privately.', 'My DEFECT card is locked.', 'My card shows my pulse.', 'I reveal DEFECT.', 'I gain more this round.'],
    speechBCompete: ['I choose privately.', 'My COOPERATE card is locked.', 'Can I anticipate the choice?', 'I reveal COOPERATE.', 'I was exploited.'],
    cooperate: 'The demonstration shows mutual cooperation and its shared payoff.',
    compete: 'The mixed-motive demonstration shows unilateral defection exploiting a cooperative partner.',
    cueNote: 'The cue is a cardiac-state signal, not a validated indicator of cooperative intent.',
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
    id: 'ultimatum',
    title: 'Ultimatum Game',
    roleA: 'Proposer',
    roleB: 'Responder',
    summary: 'The proposer divides ten tokens; the responder accepts the split or rejects it so that both players receive nothing.',
    logic: 'The proposer’s offer card carries the proposer’s cardiac cue while the responder decides whether to accept or impose costly punishment.',
    measures: 'offer size, acceptance, costly rejection, response time, payoff, cue use, and cardiac coupling.',
    phases: ['Prepare offer', 'Offer card', 'Heartbeat cue', 'Accept / reject', 'Payout'],
    speechA: ['I divide ten tokens.', 'OFFER: You 7 / Me 3.', 'My offer card shows my pulse.', 'I wait for the response.', 'The split is accepted.'],
    speechB: ['I wait for the offer.', 'The split is relatively fair.', 'I can see the pulse cue.', 'I choose ACCEPT.', 'We both receive tokens.'],
    speechACompete: ['I try to keep more.', 'OFFER: You 3 / Me 7.', 'My offer card shows my pulse.', 'Will the offer be accepted?', 'The offer was rejected.'],
    speechBCompete: ['I wait for the offer.', 'The split strongly favors A.', 'I can see the pulse cue.', 'I choose REJECT.', 'We both receive zero.'],
    cooperate: 'A balanced accepted offer benefits both participants.',
    compete: 'The proposer can demand more, while the responder can punish an unfair offer by rejecting it.',
    cueNote: 'Cardiac deceleration can accompany conflict or regulatory effort; the display is not labelled as unfairness.',
    publications: [
      {
        authors: 'Osumi & Ohira',
        year: 2009,
        title: 'Cardiac responses predict decisions in the ultimatum game',
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
        title: 'Heartbeat and Economic Decisions',
        venue: 'PLOS ONE',
        href: 'https://doi.org/10.1371/journal.pone.0108218',
        relevance: 'Records cardiovascular dynamics from proposer and responder roles.',
      },
    ],
    expressionsA: ['neutral', 'neutral', 'fear', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'surprise', 'surprise', 'anger', 'happiness'],
  },
  {
    id: 'signal',
    title: 'Joint Discrimination Task',
    roleA: 'Better-informed player',
    roleB: 'Partner',
    summary: 'Both players compare shared visual alternatives, but one receives more reliable perceptual evidence and signals an A/B judgment.',
    logic: 'This is an evidence-integration task rather than a concealed-card game. A cardiac cue is attached to the better-informed player’s response tile.',
    measures: 'joint accuracy, advice use, revision, decision time, payoff, and cardiac coupling.',
    phases: ['View shapes', 'Private judgments', 'Signal + heartbeat', 'Joint choice', 'Outcome'],
    speechA: ['I see the size evidence.', 'PRIVATE JUDGMENT: A.', 'PUBLIC SIGNAL: A.', 'I wait for the joint choice.', 'A was correct.'],
    speechB: ['I view the same alternatives.', 'My evidence is ambiguous.', 'A’s response tile shows the pulse.', 'I choose A.', 'We chose correctly.'],
    speechACompete: ['I receive stronger evidence.', 'PRIVATE JUDGMENT: A.', 'PUBLIC SIGNAL: B.', 'Will the signal persuade?', 'My private answer was A.'],
    speechBCompete: ['My evidence is ambiguous.', 'I must judge independently.', 'Is the signal misleading?', 'I choose A.', 'I resisted the bluff.'],
    cooperate: 'Common-interest payoffs reward both players for selecting the correct alternative.',
    compete: 'Deadlock-game incentives allow the better-informed player to benefit from misleading the partner.',
    cueNote: 'The public stimuli are shared size displays, not playing cards; only the response tile carries the cardiac cue.',
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
        authors: 'Bahrami et al.',
        year: 2010,
        title: 'Optimally interacting minds',
        venue: 'Science',
        href: 'https://doi.org/10.1126/science.1185718',
        relevance: 'Foundational joint perceptual-decision paradigm for integrating unequal evidence.',
      },
    ],
    expressionsA: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
    expressionsB: ['neutral', 'neutral', 'surprise', 'neutral', 'happiness'],
  },
];

export function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}
