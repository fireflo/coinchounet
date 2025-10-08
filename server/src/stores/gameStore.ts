import { randomUUID } from 'node:crypto';
import type { GameEntity } from '../types/domain.js';

const games = new Map<string, GameEntity>();

const cloneGame = (game: GameEntity): GameEntity => ({
  state: { ...game.state, contracts: [...game.state.contracts], publicContainers: { ...game.state.publicContainers } },
  hands: Object.fromEntries(
    Object.entries(game.hands).map(([playerId, hand]) => [playerId, { ...hand, cards: [...hand.cards] }]),
  ),
  turnMetadata: {
    ...game.turnMetadata,
    legalMoveTypes: [...game.turnMetadata.legalMoveTypes],
    turnSequence: [...game.turnMetadata.turnSequence],
  },
  contracts: [...game.contracts],
  currentTurnIndex: game.currentTurnIndex,
  currentTrickOrder: [...game.currentTrickOrder],
  moveResults: new Map(game.moveResults),
  biddingState: game.biddingState,
  currentBidderIndex: game.currentBidderIndex,
  completedTricks: [...game.completedTricks],
  cumulativeScores: { ...game.cumulativeScores },
  roundNumber: game.roundNumber,
});

export const gameStore = {
  create(game: GameEntity): GameEntity {
    const clone = cloneGame(game);
    games.set(game.state.gameId, clone);
    return cloneGame(clone);
  },

  upsert(game: GameEntity): GameEntity {
    const clone = cloneGame(game);
    games.set(clone.state.gameId, clone);
    return cloneGame(clone);
  },

  findById(gameId: string): GameEntity | null {
    const game = games.get(gameId);
    return game ? cloneGame(game) : null;
  },

  save(game: GameEntity): GameEntity {
    const clone = cloneGame(game);
    games.set(clone.state.gameId, clone);
    return cloneGame(clone);
  },

  generateGameId(): string {
    return `game_${randomUUID().slice(0, 8)}`;
  },

  clear(): void {
    games.clear();
  },
};
