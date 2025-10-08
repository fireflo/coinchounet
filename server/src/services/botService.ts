/**
 * Bot Service - Simple AI for Coinche
 * 
 * Strategy:
 * - Bidding: Pass most of the time, occasionally bid minimum
 * - Card Play: Play valid move, prefer highest card unless losing trick
 */

import type * as bidding from '../rules/bidding.js';
import * as coinche from '../rules/coinche.js';
import type { GameEntity } from '../types/domain.js';

export interface BotPlayer {
  userId: string;
  username: string;
  isBot: true;
}

const BOT_NAMES = [
  'Bot Alice',
  'Bot Bob',
  'Bot Charlie',
  'Bot Diana',
  'Bot Eve',
  'Bot Frank',
  'Bot Grace',
  'Bot Henry',
];

let botCounter = 0;

/**
 * Create a bot player
 */
export const createBot = (): BotPlayer => {
  const botId = `bot_${Date.now()}_${botCounter++}`;
  const botName = BOT_NAMES[botCounter % BOT_NAMES.length];
  
  return {
    userId: botId,
    username: botName,
    isBot: true,
  };
};

/**
 * Bot bidding strategy - simple and conservative
 */
export const decideBid = (
  game: GameEntity,
  botId: string,
): { action: 'bid' | 'pass' | 'coinche' | 'surcoinche'; contractType?: bidding.ContractType; value?: number } => {
  if (!game.biddingState || game.biddingState.status !== 'active') {
    return { action: 'pass' };
  }

  const hand = game.hands[botId];
  if (!hand) {
    return { action: 'pass' };
  }

  // Simple strategy: Pass 80% of the time, bid minimum 20% of the time
  const shouldBid = Math.random() < 0.2;

  if (!shouldBid || game.biddingState.currentBid) {
    // If there's already a bid, just pass (bots don't compete)
    return { action: 'pass' };
  }

  // Count strong cards (A, 10, K, J)
  const strongCards = hand.cards.filter((card) => {
    const rank = card.slice(0, -1);
    return ['A', '10', 'K', 'J'].includes(rank);
  });

  // Only bid if we have at least 4 strong cards
  if (strongCards.length >= 4) {
    // Pick a random trump suit
    const trumps: bidding.ContractType[] = ['clubs', 'diamonds', 'hearts', 'spades'];
    const contractType = trumps[Math.floor(Math.random() * trumps.length)];
    
    return {
      action: 'bid',
      contractType,
      value: 80, // Always bid minimum
    };
  }

  return { action: 'pass' };
};

/**
 * Bot card play strategy
 */
export const decideCardToPlay = (
  game: GameEntity,
  botId: string,
): string | null => {
  const hand = game.hands[botId];
  if (!hand || hand.cards.length === 0) {
    return null;
  }

  const contract = game.contracts[0];
  if (!contract) {
    // No contract yet, shouldn't happen
    return hand.cards[0];
  }

  // Build context for validation
  const ruleContext: coinche.GameContext = {
    contract: {
      ...contract,
      coinched: contract.coinched ?? false,
      surcoinched: contract.surcoinched ?? false,
    },
    currentTrick: game.currentTrickOrder as coinche.TrickCard[],
    turnOrder: game.state.turnOrder,
    hands: Object.fromEntries(
      Object.entries(game.hands).map(([playerId, h]) => [playerId, h.cards as coinche.Card[]])
    ),
  };

  // Get all valid cards
  const validCards = hand.cards.filter((card) => {
    const validation = coinche.validateMove(botId, card as coinche.Card, ruleContext);
    return validation.valid;
  });

  if (validCards.length === 0) {
    // Should never happen, but fallback to first card
    return hand.cards[0];
  }

  if (validCards.length === 1) {
    return validCards[0];
  }

  // Strategy: Play highest ranking card unless we think we're losing the trick
  const isFirstCard = game.currentTrickOrder.length === 0;
  
  if (isFirstCard) {
    // Lead with highest card
    return getHighestRankingCard(validCards, contract.type, ruleContext);
  }

  // Check if partner is winning
  const partnerIndex = (game.state.turnOrder.indexOf(botId) + 2) % 4;
  const partnerId = game.state.turnOrder[partnerIndex];
  const partnerPlayed = game.currentTrickOrder.some((tc) => tc.playerId === partnerId);

  if (partnerPlayed) {
    // Check if partner is currently winning
    const currentWinner = coinche.determineTrickWinner(
      game.currentTrickOrder as coinche.TrickCard[],
      ruleContext,
    );
    
    if (currentWinner === partnerId) {
      // Partner winning, play lowest valid card
      return getLowestRankingCard(validCards, contract.type, ruleContext);
    }
  }

  // Try to win the trick - play highest card
  return getHighestRankingCard(validCards, contract.type, ruleContext);
};

/**
 * Get highest ranking card from a list
 */
const getHighestRankingCard = (
  cards: string[],
  contractType: bidding.ContractType,
  context: coinche.GameContext,
): string => {
  if (cards.length === 0) return '';
  
  return cards.reduce((highest, current) => {
    const highestValue = getRankValue(highest, contractType, context);
    const currentValue = getRankValue(current, contractType, context);
    return currentValue < highestValue ? current : highest;
  });
};

/**
 * Get lowest ranking card from a list
 */
const getLowestRankingCard = (
  cards: string[],
  contractType: bidding.ContractType,
  context: coinche.GameContext,
): string => {
  if (cards.length === 0) return '';
  
  return cards.reduce((lowest, current) => {
    const lowestValue = getRankValue(lowest, contractType, context);
    const currentValue = getRankValue(current, contractType, context);
    return currentValue > lowestValue ? current : lowest;
  });
};

/**
 * Get rank value for a card (lower = higher rank)
 */
const getRankValue = (
  card: string,
  contractType: bidding.ContractType,
  context: coinche.GameContext,
): number => {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  
  const isTrump = contractType === 'all_trump' || 
    (contractType !== 'no_trump' && suit === getSuitSymbol(contractType));
  
  if (isTrump) {
    const trumpOrder = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
    return trumpOrder.indexOf(rank);
  } else {
    const nonTrumpOrder = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
    return nonTrumpOrder.indexOf(rank);
  }
};

/**
 * Get suit symbol from contract type
 */
const getSuitSymbol = (contractType: bidding.ContractType): string => {
  const suitMap: Record<string, string> = {
    clubs: '♣',
    diamonds: '♦',
    hearts: '♥',
    spades: '♠',
  };
  return suitMap[contractType] || '';
};

/**
 * Check if a player is a bot
 */
export const isBot = (userId: string): boolean => {
  return userId.startsWith('bot_');
};

/**
 * Execute bot turn automatically
 */
export const executeBotTurn = async (
  game: GameEntity,
  botId: string,
  gameService: any,
): Promise<void> => {
  // Small delay to simulate thinking
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

  // Check if it's bidding phase
  if (game.biddingState && game.biddingState.status === 'active') {
    const expectedBidder = game.state.turnOrder[game.currentBidderIndex];
    if (expectedBidder === botId) {
      const decision = decideBid(game, botId);
      
      try {
        if (decision.action === 'bid' && decision.contractType && decision.value) {
          await gameService.submitBid(game.state.gameId, botId, decision.contractType, decision.value);
        } else if (decision.action === 'pass') {
          await gameService.submitPass(game.state.gameId, botId);
        }
      } catch (error) {
        console.error(`Bot ${botId} bidding error:`, error);
      }
    }
  }
  // Check if it's card play phase
  else if (game.turnMetadata.activePlayerId === botId) {
    const card = decideCardToPlay(game, botId);
    
    if (card) {
      try {
        await gameService.submitMove(game.state.gameId, {
          gameId: game.state.gameId,
          playerId: botId,
          stateVersion: game.state.stateVersion,
          moveType: 'play_card',
          payload: { card },
          clientMoveId: `bot_move_${Date.now()}`,
        });
      } catch (error) {
        console.error(`Bot ${botId} move error:`, error);
      }
    }
  }
};
