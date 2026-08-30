export type Incentive = 'aligned' | 'opposed';
export type HeartAccess = 'live' | 'replay' | 'hidden';
export type Choice = 'A' | 'B';

export const jointRounds = [
  { id: 1, correct: 'A' as Choice, aSize: 66, bSize: 108, receiverTarget: 87, senderTarget: 73, difficulty: 'ambiguous' },
  { id: 2, correct: 'B' as Choice, aSize: 70, bSize: 116, receiverTarget: 93, senderTarget: 108, difficulty: 'ambiguous' },
  { id: 3, correct: 'A' as Choice, aSize: 74, bSize: 112, receiverTarget: 93, senderTarget: 81, difficulty: 'ambiguous' },
  { id: 4, correct: 'B' as Choice, aSize: 68, bSize: 110, receiverTarget: 89, senderTarget: 103, difficulty: 'ambiguous' },
] as const;

export type AgentMove = {
  advice: Choice | 'PASS';
  strategy: 'truth' | 'bluff' | 'withhold';
  bpm: number;
};

export function jointAgentMove(roundIndex: number, correct: Choice, incentive: Incentive): AgentMove {
  if (incentive === 'aligned') {
    return { advice: correct, strategy: 'truth', bpm: 72 + ((roundIndex * 3) % 5) };
  }

  const script: Array<'bluff' | 'withhold' | 'truth'> = ['bluff', 'withhold', 'truth', 'bluff'];
  const strategy = script[roundIndex];
  if (strategy === 'withhold') return { advice: 'PASS', strategy, bpm: 84 };
  if (strategy === 'truth') return { advice: correct, strategy, bpm: 79 };
  return { advice: correct === 'A' ? 'B' : 'A', strategy, bpm: 88 };
}

export const informationCards = [
  { id: 'A', rank: '7', suit: '♥', name: 'Seven of hearts', color: '#b32635' },
  { id: 'B', rank: 'Q', suit: '♠', name: 'Queen of spades', color: '#171a1e' },
  { id: 'C', rank: '4', suit: '♦', name: 'Four of diamonds', color: '#b32635' },
  { id: 'D', rank: '9', suit: '♣', name: 'Nine of clubs', color: '#171a1e' },
] as const;

export type CardId = (typeof informationCards)[number]['id'];

export const concealedRounds: Array<{ target: CardId; order: CardId[]; replayDip: CardId }> = [
  { target: 'C', order: ['B', 'D', 'C', 'A'], replayDip: 'A' },
  { target: 'A', order: ['C', 'A', 'D', 'B'], replayDip: 'D' },
  { target: 'D', order: ['A', 'C', 'B', 'D'], replayDip: 'B' },
];

export function probeBpm(
  card: CardId,
  target: CardId,
  replayDip: CardId,
  incentive: Incentive,
  access: HeartAccess,
): number {
  if (access === 'hidden') return 0;
  const contingentCard = access === 'live' ? target : replayDip;
  if (card !== contingentCard) return 77 + ((card.charCodeAt(0) + target.charCodeAt(0)) % 3);
  return incentive === 'opposed' ? 65 : 72;
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
