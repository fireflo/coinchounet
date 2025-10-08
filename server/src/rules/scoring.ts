/**
 * Coinche Scoring System
 * 
 * Implements scoring from specs/rules.md:
 * - Card point values
 * - Belote/Rebelote (20 points)
 * - Dix de der (10 points for last trick)
 * - Contract fulfillment
 * - Capot (all tricks) - 250 points
 * - Coinche multipliers (x2 for coinche, x4 for surcoinche)
 */

import type { Card, ContractType } from './coinche.js';

export interface TrickResult {
  winnerId: string;
  cards: Array<{ playerId: string; card: Card }>;
  points: number;
}

export interface BeloteAnnouncement {
  playerId: string;
  trumpSuit: string;
  kingPlayed: boolean;
  queenPlayed: boolean;
}

export interface RoundScore {
  teamACardPoints: number;
  teamBCardPoints: number;
  teamABelote: boolean;
  teamBBelote: boolean;
  dixDeDerWinner: 'teamA' | 'teamB';
  teamATricks: number;
  teamBTricks: number;
  capot: 'teamA' | 'teamB' | null;
}

export interface ContractResult {
  declaringTeam: 'teamA' | 'teamB';
  contractValue: number;
  contractType: ContractType;
  coinched: boolean;
  surcoinched: boolean;
  fulfilled: boolean;
  teamAScore: number;
  teamBScore: number;
  teamATotal: number;
  teamBTotal: number;
}

const BELOTE_POINTS = 20;
const DIX_DE_DER_POINTS = 10;
const CAPOT_POINTS = 250;
const FAILED_CONTRACT_PENALTY = 160;

/**
 * Calculate total card points in a trick
 */
export const calculateTrickPoints = (
  cards: Array<{ playerId: string; card: Card }>,
  contractType: ContractType,
): number => {
  // Import getCardValue from coinche module
  // For now, implement inline
  const getCardValue = (card: Card, isTrump: boolean): number => {
    const rank = card.slice(0, -1);
    
    if (isTrump) {
      const values: Record<string, number> = {
        J: 20,
        '9': 14,
        A: 11,
        '10': 10,
        K: 4,
        Q: 3,
        '8': 0,
        '7': 0,
      };
      return values[rank] || 0;
    } else {
      const values: Record<string, number> = {
        A: 11,
        '10': 10,
        K: 4,
        Q: 3,
        J: 2,
        '9': 0,
        '8': 0,
        '7': 0,
      };
      return values[rank] || 0;
    }
  };

  const trumpSuit = contractType === 'clubs' ? '♣' :
                    contractType === 'diamonds' ? '♦' :
                    contractType === 'hearts' ? '♥' :
                    contractType === 'spades' ? '♠' : null;

  return cards.reduce((total, { card }) => {
    const suit = card.slice(-1);
    const isTrump = contractType === 'all_trump' || 
                    (contractType !== 'no_trump' && suit === trumpSuit);
    return total + getCardValue(card, isTrump);
  }, 0);
};

/**
 * Check if Belote/Rebelote was announced
 */
export const checkBeloteAnnouncement = (
  tricks: TrickResult[],
  contractType: ContractType,
  turnOrder: string[],
): { teamA: boolean; teamB: boolean } => {
  if (contractType === 'no_trump') {
    return { teamA: false, teamB: false };
  }

  const trumpSuit = contractType === 'clubs' ? '♣' :
                    contractType === 'diamonds' ? '♦' :
                    contractType === 'hearts' ? '♥' :
                    contractType === 'spades' ? '♠' : null;

  if (!trumpSuit) return { teamA: false, teamB: false };

  const kingCard = `K${trumpSuit}` as Card;
  const queenCard = `Q${trumpSuit}` as Card;

  // Track which players played K and Q of trump
  const playersWithKing: string[] = [];
  const playersWithQueen: string[] = [];

  for (const trick of tricks) {
    for (const { playerId, card } of trick.cards) {
      if (card === kingCard) playersWithKing.push(playerId);
      if (card === queenCard) playersWithQueen.push(playerId);
    }
  }

  // Check if same player played both (or their partner)
  const teamAHasBelote = playersWithKing.some((kPlayer) => {
    const kIndex = turnOrder.indexOf(kPlayer);
    return playersWithQueen.some((qPlayer) => {
      const qIndex = turnOrder.indexOf(qPlayer);
      // Same team if both even or both odd indices
      return (kIndex % 2) === (qIndex % 2);
    });
  });

  const teamBHasBelote = playersWithKing.some((kPlayer) => {
    const kIndex = turnOrder.indexOf(kPlayer);
    return playersWithQueen.some((qPlayer) => {
      const qIndex = turnOrder.indexOf(qPlayer);
      return (kIndex % 2) !== (qIndex % 2);
    });
  });

  return {
    teamA: teamAHasBelote && turnOrder.indexOf(playersWithKing[0]) % 2 === 0,
    teamB: teamBHasBelote && turnOrder.indexOf(playersWithKing[0]) % 2 === 1,
  };
};

/**
 * Calculate round score from completed tricks
 */
export const calculateRoundScore = (
  tricks: TrickResult[],
  contractType: ContractType,
  turnOrder: string[],
): RoundScore => {
  let teamACardPoints = 0;
  let teamBCardPoints = 0;
  let teamATricks = 0;
  let teamBTricks = 0;

  // Sum up card points and trick counts
  for (const trick of tricks) {
    const winnerIndex = turnOrder.indexOf(trick.winnerId);
    const isTeamA = winnerIndex % 2 === 0;

    if (isTeamA) {
      teamACardPoints += trick.points;
      teamATricks++;
    } else {
      teamBCardPoints += trick.points;
      teamBTricks++;
    }
  }

  // Check for Belote/Rebelote
  const belote = checkBeloteAnnouncement(tricks, contractType, turnOrder);

  // Determine dix de der winner (last trick)
  const lastTrick = tricks[tricks.length - 1];
  const lastWinnerIndex = turnOrder.indexOf(lastTrick.winnerId);
  const dixDeDerWinner: 'teamA' | 'teamB' = lastWinnerIndex % 2 === 0 ? 'teamA' : 'teamB';

  // Check for capot (all tricks)
  let capot: 'teamA' | 'teamB' | null = null;
  if (teamATricks === tricks.length) capot = 'teamA';
  if (teamBTricks === tricks.length) capot = 'teamB';

  return {
    teamACardPoints,
    teamBCardPoints,
    teamABelote: belote.teamA,
    teamBBelote: belote.teamB,
    dixDeDerWinner,
    teamATricks,
    teamBTricks,
    capot,
  };
};

/**
 * Calculate final contract result with multipliers
 * FIXME: For all-trmp and no-trump, a rtatio must be applied to the final score before comparing with the contract. 
 */
export const calculateContractResult = (
  roundScore: RoundScore,
  declaringTeam: 'teamA' | 'teamB',
  contractValue: number,
  contractType: ContractType,
  coinched: boolean,
  surcoinched: boolean,
): ContractResult => {
  // Calculate base scores
  let teamATotal = roundScore.teamACardPoints;
  let teamBTotal = roundScore.teamBCardPoints;

  // Add Belote/Rebelote
  if (roundScore.teamABelote) teamATotal += BELOTE_POINTS;
  if (roundScore.teamBBelote) teamBTotal += BELOTE_POINTS;

  // Add dix de der
  if (roundScore.dixDeDerWinner === 'teamA') {
    teamATotal += DIX_DE_DER_POINTS;
  } else {
    teamBTotal += DIX_DE_DER_POINTS;
  }

  // Handle capot
  if (roundScore.capot) {
    if (roundScore.capot === declaringTeam) {
      // Declaring team wins all tricks
      const capotScore = CAPOT_POINTS;
      if (declaringTeam === 'teamA') {
        teamATotal = capotScore;
        teamBTotal = 0;
      } else {
        teamBTotal = capotScore;
        teamATotal = 0;
      }
    } else {
      // Defenders win all tricks - 500 points
      if (declaringTeam === 'teamA') {
        teamBTotal = 500;
        teamATotal = 0;
      } else {
        teamATotal = 500;
        teamBTotal = 0;
      }
    }
  }

  // Check contract fulfillment
  const declaringTeamTotal = declaringTeam === 'teamA' ? teamATotal : teamBTotal;
  const fulfilled = declaringTeamTotal >= contractValue;

  // Calculate final scores
  let teamAScore = 0;
  let teamBScore = 0;

  if (fulfilled) {
    // Contract fulfilled - both teams score their points
    teamAScore = teamATotal;
    teamBScore = teamBTotal;
  } else {
    // Contract failed - all points go to defenders plus penalty
    if (declaringTeam === 'teamA') {
      teamAScore = 0;
      teamBScore = teamATotal + teamBTotal + FAILED_CONTRACT_PENALTY;
    } else {
      teamBScore = 0;
      teamAScore = teamATotal + teamBTotal + FAILED_CONTRACT_PENALTY;
    }
  }

  // Apply coinche multipliers
  const multiplier = surcoinched ? 4 : coinched ? 2 : 1;
  teamAScore *= multiplier;
  teamBScore *= multiplier;

  // Round to nearest 10
  teamAScore = Math.round(teamAScore / 10) * 10;
  teamBScore = Math.round(teamBScore / 10) * 10;

  return {
    declaringTeam,
    contractValue,
    contractType,
    coinched,
    surcoinched,
    fulfilled,
    teamAScore,
    teamBScore,
    teamATotal,
    teamBTotal,
  };
};

/**
 * Check if game is over (team reached target score)
 */
export const isGameOver = (
  teamAScore: number,
  teamBScore: number,
  targetScore: number = 1000,
): { over: boolean; winner: 'teamA' | 'teamB' | null } => {
  if (teamAScore >= targetScore && teamAScore > teamBScore) {
    return { over: true, winner: 'teamA' };
  }
  if (teamBScore >= targetScore && teamBScore > teamAScore) {
    return { over: true, winner: 'teamB' };
  }
  if (teamAScore >= targetScore && teamBScore >= targetScore) {
    // Both reached target - highest wins
    return { over: true, winner: teamAScore > teamBScore ? 'teamA' : 'teamB' };
  }
  return { over: false, winner: null };
};
