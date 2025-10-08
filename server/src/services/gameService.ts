import { randomUUID } from 'node:crypto';
import type { GameState, MoveResult, MoveSubmission, PrivateHand, TurnMetadata } from '../types/api.js';
import type { GameEntity, MoveContext, RoomEntity } from '../types/domain.js';

import { HttpError } from '../errors.js';
import type { TypedServer } from '../realtime/socketServer.js';
import { eventStore } from '../stores/eventStore.js';
import { gameStore } from '../stores/gameStore.js';
import { roomStore } from '../stores/roomStore.js';

import * as bidding from '../rules/bidding.js';
import * as coinche from '../rules/coinche.js';
import * as scoring from '../rules/scoring.js';

import * as botService from './botService.js';
import { setGameService } from './roomService.js';

// Initialize room service reference
setGameService(null); // Will be set after export

const getSocketIO = (): TypedServer | null => {
  return (global as any).io || null;
};

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'] as const;
const CARDS = SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit}`));

const createDeck = () => [...CARDS];

const shuffleDeck = (deck: string[]) => {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const dealHands = (players: string[], cardsPerPlayer = 8) => {
  const deck = shuffleDeck(createDeck());
  const hands: Record<string, PrivateHand> = {};
  players.forEach((playerId, index) => {
    const start = index * cardsPerPlayer;
    const end = start + cardsPerPlayer;
    const cards = deck.slice(start, end);
    hands[playerId] = {
      playerId,
      gameId: '',
      cards,
      handVersion: 1,
      lastUpdated: new Date().toISOString(),
    };
  });
  return hands;
};

const buildInitialGameState = (gameId: string, room: RoomEntity, turnOrder: string[]): GameEntity => {
  const hands = dealHands(turnOrder);
  Object.values(hands).forEach((hand) => {
    hand.gameId = gameId;
  });

  const turnId = `turn_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const state: GameState = {
    gameId,
    roomId: room.roomId,
    status: 'in_progress',
    turnId,
    turnOrder,
    stateVersion: 1,
    score: { teamA: 0, teamB: 0 },
    contracts: [],
    publicContainers: {
      drawPileCount: CARDS.length - turnOrder.length * hands[turnOrder[0]].cards.length,
      currentTrick: { order: [] },
      trickHistoryCount: 0,
    },
    lastUpdated: now,
  };

  const turnMetadata: TurnMetadata = {
    turnId,
    activePlayerId: turnOrder[0],
    legalMoveTypes: ['bid', 'pass'], // Start with bidding
    turnSequence: turnOrder,
  };

  return {
    state,
    hands,
    turnMetadata,
    contracts: [],
    currentTurnIndex: 0,
    currentTrickOrder: [],
    moveResults: new Map(),
    // Bidding phase
    biddingState: bidding.createInitialBiddingState(),
    currentBidderIndex: 0,
    // Scoring
    completedTricks: [],
    cumulativeScores: { teamA: 0, teamB: 0 },
    roundNumber: 1,
  };
};

const toGameStateDto = (game: GameEntity): GameState => ({
  ...game.state,
  publicContainers: {
    ...game.state.publicContainers,
    currentTrick: { order: [...game.currentTrickOrder] },
  },
});

const updateStateVersion = (game: GameEntity) => {
  game.state.stateVersion += 1;
  game.state.lastUpdated = new Date().toISOString();
};

const removeCardFromHand = (hand: PrivateHand, card: string) => {
  const index = hand.cards.indexOf(card);
  if (index === -1) {
    throw new HttpError(422, 'illegal_move', `Card ${card} is not in hand`);
  }
  hand.cards.splice(index, 1);
  hand.handVersion += 1;
  hand.lastUpdated = new Date().toISOString();
};

const advanceTurn = (game: GameEntity, winnerId?: string) => {
  if (winnerId) {
    game.currentTurnIndex = game.state.turnOrder.indexOf(winnerId);
  } else {
    game.currentTurnIndex = (game.currentTurnIndex + 1) % game.state.turnOrder.length;
  }
  const nextPlayer = game.state.turnOrder[game.currentTurnIndex];
  const newTurnId = `turn_${randomUUID().slice(0, 8)}`;
  game.state.turnId = newTurnId;
  game.turnMetadata = {
    turnId: newTurnId,
    activePlayerId: nextPlayer,
    legalMoveTypes: ['play_card'],
    deadline: undefined,
    turnSequence: game.state.turnOrder,
  };
};

const determineTrickWinner = (trickOrder: Array<{ playerId: string; card: string }>, game: GameEntity): string => {
  if (trickOrder.length === 0) return '';
  
  // Build context for rule validator
  const contract = game.contracts[0];
  const context: coinche.GameContext = {
    contract: contract ? {
      ...contract,
      coinched: contract.coinched ?? false,
      surcoinched: contract.surcoinched ?? false,
    } : undefined,
    currentTrick: trickOrder as coinche.TrickCard[],
    turnOrder: game.state.turnOrder,
    hands: Object.fromEntries(
      Object.entries(game.hands).map(([playerId, hand]) => [playerId, hand.cards as coinche.Card[]])
    ),
  };
  
  return coinche.determineTrickWinner(trickOrder as coinche.TrickCard[], context);
};

const buildMoveResult = (context: MoveContext, game: GameEntity): MoveResult => ({
  moveId: `move_${randomUUID().slice(0, 8)}`,
  clientMoveId: context.clientMoveId,
  validationStatus: 'accepted',
  turnId: game.state.turnId,
  stateVersion: game.state.stateVersion,
  effects: {
    cardPlayed: context.payload.card,
    nextPlayerId: game.turnMetadata.activePlayerId,
  },
  occurredAt: new Date().toISOString(),
});

const ensureActivePlayer = (game: GameEntity, playerId: string) => {
  if (game.turnMetadata.activePlayerId !== playerId) {
    throw new HttpError(403, 'forbidden', 'Not your turn');
  }
};

const ensureVersion = (game: GameEntity, expectedVersion: number) => {
  if (game.state.stateVersion !== expectedVersion) {
    throw new HttpError(409, 'version_conflict', 'State version mismatch', {
      details: { stateVersion: game.state.stateVersion },
    });
  }
};

const ensureMoveType = (move: MoveSubmission) => {
  if (move.moveType !== 'play_card') {
    throw new HttpError(422, 'illegal_move', `Unsupported move type ${move.moveType}`);
  }
  if (!move.payload || typeof move.payload !== 'object' || typeof move.payload.card !== 'string') {
    throw new HttpError(400, 'invalid_payload', 'Move payload must include card');
  }
};

export const gameService = {
  startFromRoom(room: RoomEntity) {
    const seatsFilled = room.seats.every((seat) => seat.playerId);
    if (!seatsFilled) {
      throw new HttpError(422, 'unprocessable_entity', 'All seats must be filled to start');
    }
    const allReady = room.seats.every((seat) => seat.ready);
    if (!allReady) {
      throw new HttpError(422, 'unprocessable_entity', 'All players must be ready to start');
    }

    const turnOrder = room.seats.map((seat) => seat.playerId as string);
    const gameId = gameStore.generateGameId();
    const game = buildInitialGameState(gameId, room, turnOrder);
    const saved = gameStore.create(game);

    room.status = 'in_progress';
    room.locked = true;
    room.seats.forEach((seat) => {
      seat.ready = false;
    });
    roomStore.save(room);

    // Publish game started event
    eventStore.append(gameId, 'game.started', {
      gameId,
      roomId: room.roomId,
      turnOrder,
      turnId: saved.state.turnId,
      activePlayerId: saved.turnMetadata.activePlayerId,
    });

    // Broadcast via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`room:${room.roomId}`).emit('room:game_started', {
        roomId: room.roomId,
        gameId,
      });
      io.to(`game:${gameId}:public`).emit('game:state_changed', {
        gameId,
        stateVersion: saved.state.stateVersion,
        eventType: 'game.started',
      });
    }

    return toGameStateDto(saved);
  },

  getGameState(gameId: string): GameState {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }
    return toGameStateDto(game);
  },

  getGameStateSince(gameId: string, sinceVersion?: number): GameState | { stateVersion: number } {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }
    if (!sinceVersion || sinceVersion < game.state.stateVersion) {
      return toGameStateDto(game);
    }
    return { stateVersion: game.state.stateVersion };
  },

  getTurnMetadata(gameId: string): TurnMetadata {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }
    return { ...game.turnMetadata, legalMoveTypes: [...game.turnMetadata.legalMoveTypes], turnSequence: [...game.turnMetadata.turnSequence] };
  },

  getPrivateHand(gameId: string, playerId: string): PrivateHand {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }
    const hand = game.hands[playerId];
    if (!hand) {
      throw new HttpError(404, 'not_found', 'Hand not found for player');
    }
    return { ...hand, cards: [...hand.cards] };
  },

  submitMove(gameId: string, context: MoveContext): MoveResult {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }

    if (game.moveResults.has(context.clientMoveId)) {
      return game.moveResults.get(context.clientMoveId)!;
    }

    ensureActivePlayer(game, context.playerId);
    ensureVersion(game, context.stateVersion);

    const move: MoveSubmission = {
      clientMoveId: context.clientMoveId,
      moveType: context.moveType,
      payload: context.payload,
      stateVersion: context.stateVersion,
    };
    ensureMoveType(move);
    const card = move.payload.card as string;

    const hand = game.hands[context.playerId];
    if (!hand) {
      throw new HttpError(404, 'not_found', 'Hand not found for player');
    }

    // Validate move using full coinche rules
    const contract = game.contracts[0];
    const ruleContext: coinche.GameContext = {
      contract: contract ? {
        ...contract,
        coinched: contract.coinched ?? false,
        surcoinched: contract.surcoinched ?? false,
      } : undefined,
      currentTrick: game.currentTrickOrder as coinche.TrickCard[],
      turnOrder: game.state.turnOrder,
      hands: Object.fromEntries(
        Object.entries(game.hands).map(([playerId, h]) => [playerId, h.cards as coinche.Card[]])
      ),
    };
    
    const validation = coinche.validateMove(context.playerId, card as coinche.Card, ruleContext);
    if (!validation.valid) {
      throw new HttpError(422, 'illegal_move', 'Move violates game rules', {
        details: { violations: validation.violations },
      });
    }

    removeCardFromHand(hand, card);
    game.currentTrickOrder.push({ playerId: context.playerId, card });
    updateStateVersion(game);

    const trickComplete = game.currentTrickOrder.length === game.state.turnOrder.length;
    let winnerId: string | undefined;
    if (trickComplete) {
      winnerId = determineTrickWinner(game.currentTrickOrder, game);
      
      // Calculate trick points and store completed trick
      const contract = game.contracts[0];
      const trickPoints = contract ? scoring.calculateTrickPoints(
        game.currentTrickOrder as Array<{ playerId: string; card: coinche.Card }>,
        contract.type as coinche.ContractType
      ) : 0;
      
      game.completedTricks.push({
        winnerId,
        cards: game.currentTrickOrder.map(tc => ({ playerId: tc.playerId, card: tc.card as coinche.Card })),
        points: trickPoints,
      });
      
      game.state.publicContainers.trickHistoryCount = (game.state.publicContainers.trickHistoryCount ?? 0) + 1;
      game.currentTrickOrder = [];
      
      // Check if round is complete (all 8 tricks played)
      if (game.completedTricks.length === 8) {
        this.calculateRoundScore(game.state.gameId);
      }
    }

    advanceTurn(game, winnerId);
    const result = buildMoveResult(context, game);
    game.moveResults.set(context.clientMoveId, result);
    gameStore.save(game);

    eventStore.append(gameId, 'turn.move.accepted', {
      moveId: result.moveId,
      stateVersion: game.state.stateVersion,
      playerId: context.playerId,
    });

    // Broadcast via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`game:${gameId}:public`).emit('game:move_accepted', {
        gameId,
        moveId: result.moveId,
        playerId: context.playerId,
        stateVersion: game.state.stateVersion,
      });
    }

    if (trickComplete) {
      eventStore.append(gameId, 'turn.changed', {
        turnId: game.state.turnId,
        activePlayerId: game.turnMetadata.activePlayerId,
      });

      // Broadcast turn change
      if (io) {
        io.to(`game:${gameId}:public`).emit('game:turn_changed', {
          gameId,
          turnId: game.state.turnId,
          activePlayerId: game.turnMetadata.activePlayerId,
        });
      }
    }
    
    // Trigger bot if it's their turn
    this.triggerBotTurn(game);

    return result;
  },

  listEvents(gameId: string, after?: string | null) {
    return eventStore.list(gameId, after);
  },

  invalidateMove(gameId: string, moveId: string) {
    eventStore.append(gameId, 'turn.move.invalidated', { moveId });
  },

  // Bidding phase methods
  submitBid(
    gameId: string,
    playerId: string,
    contractType: bidding.ContractType,
    value: number,
  ): { success: boolean; biddingState: bidding.BiddingState } {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }

    if (!game.biddingState || game.biddingState.status !== 'active') {
      throw new HttpError(422, 'unprocessable_entity', 'Bidding phase is not active');
    }

    // Check if it's player's turn to bid
    const expectedBidder = game.state.turnOrder[game.currentBidderIndex];
    if (playerId !== expectedBidder) {
      throw new HttpError(403, 'forbidden', 'Not your turn to bid');
    }

    const bid: bidding.Bid = {
      playerId,
      contractType,
      value,
      timestamp: new Date().toISOString(),
    };

    try {
      game.biddingState = bidding.processBid(bid, game.biddingState);
      game.currentBidderIndex = (game.currentBidderIndex + 1) % game.state.turnOrder.length;
      game.turnMetadata.activePlayerId = game.state.turnOrder[game.currentBidderIndex];
      updateStateVersion(game);
      gameStore.save(game);

      // Broadcast bid event
      const io = getSocketIO();
      if (io) {
        io.to(`game:${gameId}:public`).emit('game:state_changed', {
          gameId,
          stateVersion: game.state.stateVersion,
          eventType: 'bid.placed',
        });
      }

      eventStore.append(gameId, 'bid.placed', { playerId, contractType, value });

      // Check if bidding ended
      if (game.biddingState.status === 'ended' && game.biddingState.winningBid) {
        this.finalizeBidding(game);
      }

      return { success: true, biddingState: game.biddingState };
    } catch (error) {
      throw new HttpError(422, 'illegal_move', (error as Error).message);
    }
  },

  submitPass(gameId: string, playerId: string): { success: boolean; biddingState: bidding.BiddingState } {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }

    if (!game.biddingState || game.biddingState.status !== 'active') {
      throw new HttpError(422, 'unprocessable_entity', 'Bidding phase is not active');
    }

    const expectedBidder = game.state.turnOrder[game.currentBidderIndex];
    if (playerId !== expectedBidder) {
      throw new HttpError(403, 'forbidden', 'Not your turn to bid');
    }

    game.biddingState = bidding.processPass(playerId, game.biddingState);
    game.currentBidderIndex = (game.currentBidderIndex + 1) % game.state.turnOrder.length;
    game.turnMetadata.activePlayerId = game.state.turnOrder[game.currentBidderIndex];
    updateStateVersion(game);
    gameStore.save(game);

    // Broadcast pass event
    const io = getSocketIO();
    if (io) {
      io.to(`game:${gameId}:public`).emit('game:state_changed', {
        gameId,
        stateVersion: game.state.stateVersion,
        eventType: 'bid.passed',
      });
    }

    eventStore.append(gameId, 'bid.passed', { playerId });

    // Check if bidding ended or redeal needed
    if (game.biddingState.status === 'ended' && game.biddingState.winningBid) {
      this.finalizeBidding(game);
    } else if (game.biddingState.status === 'redeal') {
      // Handle redeal
      eventStore.append(gameId, 'game.redeal', { reason: 'Four passes without bid' });
    }

    return { success: true, biddingState: game.biddingState };
  },

  submitCoinche(gameId: string, playerId: string): { success: boolean; biddingState: bidding.BiddingState } {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }

    if (!game.biddingState || game.biddingState.status !== 'active') {
      throw new HttpError(422, 'unprocessable_entity', 'Bidding phase is not active');
    }

    try {
      game.biddingState = bidding.processCoinche(playerId, game.biddingState, game.state.turnOrder);
      updateStateVersion(game);
      gameStore.save(game);

      // Broadcast coinche event
      const io = getSocketIO();
      if (io) {
        io.to(`game:${gameId}:public`).emit('game:state_changed', {
          gameId,
          stateVersion: game.state.stateVersion,
          eventType: 'bid.coinched',
        });
      }

      eventStore.append(gameId, 'bid.coinched', { playerId });

      // Coinche ends bidding
      if (game.biddingState.status === 'ended' && game.biddingState.winningBid) {
        this.finalizeBidding(game);
      }

      return { success: true, biddingState: game.biddingState };
    } catch (error) {
      throw new HttpError(422, 'illegal_move', (error as Error).message);
    }
  },

  submitSurcoinche(gameId: string, playerId: string): { success: boolean; biddingState: bidding.BiddingState } {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }

    if (!game.biddingState || game.biddingState.status !== 'active') {
      throw new HttpError(422, 'unprocessable_entity', 'Bidding phase is not active');
    }

    try {
      game.biddingState = bidding.processSurcoinche(playerId, game.biddingState, game.state.turnOrder);
      updateStateVersion(game);
      gameStore.save(game);

      // Broadcast surcoinche event
      const io = getSocketIO();
      if (io) {
        io.to(`game:${gameId}:public`).emit('game:state_changed', {
          gameId,
          stateVersion: game.state.stateVersion,
          eventType: 'bid.surcoinched',
        });
      }

      eventStore.append(gameId, 'bid.surcoinched', { playerId });

      // Surcoinche ends bidding
      if (game.biddingState.status === 'ended' && game.biddingState.winningBid) {
        this.finalizeBidding(game);
      }

      return { success: true, biddingState: game.biddingState };
    } catch (error) {
      throw new HttpError(422, 'illegal_move', (error as Error).message);
    }
  },

  finalizeBidding(game: GameEntity) {
    if (!game.biddingState?.winningBid) return;

    const winningBid = game.biddingState.winningBid;
    const declaringTeam = bidding.getWinningTeam(winningBid, game.state.turnOrder);

    // Create contract
    const contract = {
      team: declaringTeam,
      type: winningBid.contractType,
      value: winningBid.value,
      coinched: game.biddingState.coinched,
      surcoinched: game.biddingState.surcoinched,
    };

    game.contracts = [contract];
    game.state.contracts = [contract];

    // Switch to card play phase
    game.turnMetadata.legalMoveTypes = ['play_card'];
    game.biddingState = null; // Clear bidding state

    updateStateVersion(game);
    gameStore.save(game);

    // Broadcast contract finalized
    const io = getSocketIO();
    if (io) {
      io.to(`game:${game.state.gameId}:public`).emit('game:state_changed', {
        gameId: game.state.gameId,
        stateVersion: game.state.stateVersion,
        eventType: 'contract.finalized',
      });
    }

    eventStore.append(game.state.gameId, 'contract.finalized', { contract });
    
    // Trigger bot if it's their turn to play first card
    this.triggerBotTurn(game);
  },

  triggerBotTurn(game: GameEntity) {
    // Check if current player is a bot
    const currentPlayer = game.biddingState 
      ? game.state.turnOrder[game.currentBidderIndex]
      : game.turnMetadata.activePlayerId;

    if (botService.isBot(currentPlayer)) {
      // Execute bot turn asynchronously
      setTimeout(() => {
        botService.executeBotTurn(game, currentPlayer, this).catch((error) => {
          console.error(`Bot turn error for ${currentPlayer}:`, error);
        });
      }, 500);
    }
  },

  // Scoring methods
  calculateRoundScore(gameId: string): scoring.ContractResult | null {
    const game = gameStore.findById(gameId);
    if (!game) {
      throw new HttpError(404, 'not_found', `Game ${gameId} not found`);
    }

    // Check if all tricks are completed
    if (game.completedTricks.length < 8) {
      return null; // Round not complete
    }

    const contract = game.contracts[0];
    if (!contract) {
      throw new HttpError(422, 'unprocessable_entity', 'No contract found');
    }

    // Calculate round score
    const roundScore = scoring.calculateRoundScore(
      game.completedTricks,
      contract.type,
      game.state.turnOrder,
    );

    // Calculate final result with contract
    const result = scoring.calculateContractResult(
      roundScore,
      contract.team,
      contract.value,
      contract.type,
      contract.coinched ?? false,
      contract.surcoinched ?? false,
    );

    // Update cumulative scores
    game.cumulativeScores.teamA += result.teamAScore;
    game.cumulativeScores.teamB += result.teamBScore;
    game.state.score = { ...game.cumulativeScores };

    // Check if game is over
    const gameOver = scoring.isGameOver(game.cumulativeScores.teamA, game.cumulativeScores.teamB);

    if (gameOver.over) {
      game.state.status = 'completed';
      eventStore.append(gameId, 'game.completed', {
        winner: gameOver.winner,
        finalScores: game.cumulativeScores,
      });
    } else {
      // Prepare for next round
      game.roundNumber++;
      game.completedTricks = [];
      game.biddingState = bidding.createInitialBiddingState();
      game.turnMetadata.legalMoveTypes = ['bid', 'pass'];
    }

    updateStateVersion(game);
    gameStore.save(game);

    // Broadcast round complete
    const io = getSocketIO();
    if (io) {
      io.to(`game:${gameId}:public`).emit('game:state_changed', {
        gameId,
        stateVersion: game.state.stateVersion,
        eventType: gameOver.over ? 'game.completed' : 'round.completed',
      });
    }

    eventStore.append(gameId, 'round.completed', { result, cumulativeScores: game.cumulativeScores });

    return result;
  },
};

// Initialize room service reference after export
setGameService(gameService);
