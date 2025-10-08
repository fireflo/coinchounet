import type {
  Contract,
  GameState,
  MoveResult,
  PrivateHand,
  Room,
  Seat,
  TurnMetadata,
  EventEnvelope,
} from './api.js';
import type { BiddingState } from '../rules/bidding.js';
import type { TrickResult } from '../rules/scoring.js';

export interface RoomEntity extends Room {
  locked: boolean;
}

export interface CreateRoomInput {
  gameType: Room['gameType'];
  maxSeats: number;
  visibility: Room['visibility'];
  rulesetVersion: string;
  metadata?: Record<string, unknown>;
  hostId: string;
}

export interface RoomFilters {
  gameType?: Room['gameType'];
  visibility?: Room['visibility'];
  status?: Room['status'];
  page?: number;
  pageSize?: number;
}

export interface GameEntity {
  state: GameState;
  hands: Record<string, PrivateHand>;
  turnMetadata: TurnMetadata;
  contracts: Contract[];
  currentTurnIndex: number;
  currentTrickOrder: Array<{ playerId: string; card: string }>;
  moveResults: Map<string, MoveResult>;
  // Bidding phase
  biddingState: BiddingState | null;
  currentBidderIndex: number;
  // Scoring
  completedTricks: TrickResult[];
  cumulativeScores: { teamA: number; teamB: number };
  roundNumber: number;
}

export interface GameCreateContext {
  room: RoomEntity;
  createdBy: string;
}

export interface MoveContext {
  gameId: string;
  playerId: string;
  stateVersion: number;
  moveType: string;
  payload: Record<string, unknown>;
  clientMoveId: string;
}

export interface GameEventEnvelope extends EventEnvelope {}

export type SeatEntity = Seat;
