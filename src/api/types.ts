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
  metadata?: {
    language?: string;
  };
  createdAt: string;
  visibility?: Visibility;
}

export interface PaginatedRooms {
  items: Room[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Contract {
  team: 'teamA' | 'teamB';
  type: 'clubs' | 'diamonds' | 'hearts' | 'spades' | 'no' | 'all';
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

export interface SocketAck {
  ok?: boolean;
  stateVersion?: number;
  error?: string;
}
