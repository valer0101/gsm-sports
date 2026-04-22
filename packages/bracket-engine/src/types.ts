export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  number: string | number;
  seed?: number;
  photoUrl?: string | null;
}

export interface Match {
  id: string;
  round: number;
  matchIndex: number;
  player1: Player;
  player2: Player;
  winner: string | null;
  loser: string | null;
  feeder1?: string;
  feeder2?: string;
  isLosers?: boolean;
  // Audit fields
  enteredBy?: string | null;
  enteredAt?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
}

export interface GrandFinalMatch {
  id: string;
  player1: Player;
  player2: Player;
  winner: string | null;
  loser: string | null;
  // Audit fields
  enteredBy?: string | null;
  enteredAt?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
}

export interface SuperFinalMatch extends GrandFinalMatch {
  needed: boolean;
}

export interface BracketData {
  players: Player[];
  bracketSize: number;
  wbRounds: number;
  winnersBracket: Match[][];
  losersBracket: Match[][];
  grandFinal: GrandFinalMatch;
  superFinal: SuperFinalMatch;
  champion: string | null;
  status: 'active' | 'completed';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const TBD_PLAYER: Player = Object.freeze({
  id: 'tbd',
  firstName: 'TBD',
  lastName: '',
  number: '?',
});

export const BYE_PLAYER: Player = Object.freeze({
  id: 'bye',
  firstName: 'BYE',
  lastName: '',
  number: '-',
});
