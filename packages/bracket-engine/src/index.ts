export {
  generateDoubleElimination,
  selectWinner,
  propagateResults,
  findMatch,
  walkBracketMatches,
  isPlayableMatch,
  getPlayerObj,
  resetMatch,
  canRecordResult,
  validateResult,
  replacePlayerInSlot,
  withdrawPlayerFromSlot,
} from './bracket-logic';
export type {
  Player,
  Match,
  GrandFinalMatch,
  SuperFinalMatch,
  BracketData,
  ValidationResult,
} from './types';
export type { BracketSection, BracketMatchVisitor } from './bracket-logic';
export { TBD_PLAYER, BYE_PLAYER } from './types';
