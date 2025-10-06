export type Visibility = 'public' | 'private';
export type RoomStatus = 'lobby' | 'in_progress' | 'completed';

export interface Seat {
  index: number;
  playerId: string | null;
  ready: boolean;
}

export interface Room {
  roomId: string;
  gameType: 'coinche';
  status: RoomStatus;
  hostId: string;
  maxSeats: number;
  seats: Seat[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  visibility?: Visibility;
  rulesetVersion: string;
  locked?: boolean;
}

export interface PaginatedRooms {
  items: Room[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Contract {
  team: 'teamA' | 'teamB';
  type: 'clubs' | 'diamonds' | 'hearts' | 'spades' | 'no_trump' | 'all_trump';
  value: number;
  coinched?: boolean;
  surcoinched?: boolean;
}

export interface PublicContainers {
  drawPileCount?: number;
  discardPileTop?: string | null;
  currentTrick?: {
    order: Array<{
      playerId: string;
      card: string;
    }>;
    winningPlayerId?: string;
  };
  trickHistoryCount?: number;
}

export interface GameState {
  gameId: string;
  roomId: string;
  status: 'in_progress' | 'completed' | 'paused';
  turnId: string;
  turnOrder: string[];
  stateVersion: number;
  score: {
    teamA: number;
    teamB: number;
  };
  contracts: Contract[];
  publicContainers: PublicContainers;
  lastUpdated: string;
}

export interface PrivateHand {
  playerId: string;
  gameId: string;
  cards: string[];
  handVersion: number;
  lastUpdated: string;
}

export interface TurnMetadata {
  turnId: string;
  activePlayerId: string;
  legalMoveTypes: string[];
  deadline?: string;
  turnSequence: string[];
}

export interface MoveSubmission {
  clientMoveId: string;
  moveType: string;
  payload: Record<string, unknown>;
  stateVersion: number;
}

export interface MoveResult {
  moveId: string;
  clientMoveId: string;
  validationStatus: 'accepted' | 'rejected';
  turnId: string;
  stateVersion: number;
  effects: Record<string, unknown>;
  occurredAt: string;
}

export interface EventEnvelope {
  eventId: string;
  eventType: string;
  occurredAt: string;
  source: string;
  gameId: string;
  payload: Record<string, unknown>;
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    correlationId: string;
  };
}
