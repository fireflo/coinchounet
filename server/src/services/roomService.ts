import { HttpError } from '../errors.js';
import type { Room } from '../types/api.js';
import type { CreateRoomInput, RoomEntity, RoomFilters } from '../types/domain.js';

import { roomStore } from '../stores/roomStore.js';

import * as botService from './botService.js';

// Forward declaration to avoid circular dependency
let gameServiceRef: any = null;
export const setGameService = (gs: any) => {
  gameServiceRef = gs;
};

interface PaginatedRooms {
  items: Room[];
  page: number;
  pageSize: number;
  total: number;
}

const toRoomDto = (room: RoomEntity): Room => ({
  roomId: room.roomId,
  gameType: room.gameType,
  status: room.status,
  hostId: room.hostId,
  maxSeats: room.maxSeats,
  seats: room.seats.map((seat) => ({ ...seat })),
  metadata: room.metadata ? { ...room.metadata } : undefined,
  createdAt: room.createdAt,
  visibility: room.visibility,
  rulesetVersion: room.rulesetVersion,
  locked: room.locked,
});

const paginate = (filters: RoomFilters = {}) => {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 200);
  return { page, pageSize };
};

const ensureRoomExists = (roomId: string): RoomEntity => {
  const room = roomStore.findById(roomId);
  if (!room) {
    throw new HttpError(404, 'not_found', `Room ${roomId} not found`);
  }
  return room;
};

const findSeatForPlayer = (room: RoomEntity, playerId: string) => room.seats.find((seat) => seat.playerId === playerId);

const assignSeat = (room: RoomEntity, playerId: string, seatIndex?: number) => {
  const existingSeat = findSeatForPlayer(room, playerId);
  if (existingSeat) {
    return existingSeat;
  }

  if (seatIndex !== undefined) {
    const seat = room.seats[seatIndex];
    if (!seat) {
      throw new HttpError(404, 'not_found', `Seat ${seatIndex} does not exist`);
    }
    if (seat.playerId && seat.playerId !== playerId) {
      throw new HttpError(409, 'conflict', 'Seat already occupied');
    }
    seat.playerId = playerId;
    seat.ready = false;
    return seat;
  }

  const firstOpenSeat = room.seats.find((seat) => seat.playerId === null);
  if (!firstOpenSeat) {
    throw new HttpError(409, 'conflict', 'No available seats');
  }
  firstOpenSeat.playerId = playerId;
  firstOpenSeat.ready = false;
  return firstOpenSeat;
};

const ensureHost = (room: RoomEntity, userId: string) => {
  if (room.hostId !== userId) {
    throw new HttpError(403, 'forbidden', 'Only the host can perform this action');
  }
};

export const roomService = {
  createRoom(hostId: string, payload: CreateRoomInput): Room {
    const room = roomStore.create({ ...payload, hostId });
    return toRoomDto(room);
  },

  listRooms(filters: RoomFilters = {}): PaginatedRooms {
    const { page, pageSize } = paginate(filters);
    const { items, total } = roomStore.list({ ...filters, page, pageSize });
    return {
      items: items.map(toRoomDto),
      page,
      pageSize,
      total,
    };
  },

  getRoom(roomId: string): Room {
    const room = ensureRoomExists(roomId);
    return toRoomDto(room);
  },

  joinRoom(roomId: string, playerId: string, seatIndex?: number, asSpectator = false): Room {
    const room = ensureRoomExists(roomId);
    if (room.status !== 'lobby') {
      throw new HttpError(403, 'forbidden', 'Cannot join a room that is not in lobby state');
    }

    if (!asSpectator) {
      assignSeat(room, playerId, seatIndex);
    }

    const updated = roomStore.save(room);
    return toRoomDto(updated);
  },

  leaveRoom(roomId: string, playerId: string): Room {
    const room = ensureRoomExists(roomId);
    const seat = findSeatForPlayer(room, playerId);
    if (!seat) {
      throw new HttpError(404, 'not_found', 'Player is not seated in this room');
    }
    seat.playerId = null;
    seat.ready = false;
    const updated = roomStore.save(room);
    return toRoomDto(updated);
  },

  removePlayer(roomId: string, hostId: string, targetPlayerId: string): Room {
    const room = ensureRoomExists(roomId);
    ensureHost(room, hostId);

    const seat = findSeatForPlayer(room, targetPlayerId);
    if (!seat) {
      throw new HttpError(404, 'not_found', 'Player is not seated in this room');
    }
    seat.playerId = null;
    seat.ready = false;
    const updated = roomStore.save(room);
    return toRoomDto(updated);
  },

  toggleReady(roomId: string, playerId: string, ready: boolean): Room {
    const room = ensureRoomExists(roomId);
    const seat = findSeatForPlayer(room, playerId);
    if (!seat) {
      throw new HttpError(404, 'not_found', 'Player is not seated in this room');
    }
    seat.ready = ready;
    const updated = roomStore.save(room);
    return toRoomDto(updated);
  },

  lockRoom(roomId: string, hostId: string): Room {
    const room = ensureRoomExists(roomId);
    ensureHost(room, hostId);
    room.locked = true;
    const updated = roomStore.save(room);
    return toRoomDto(updated);
  },

  unlockRoom(roomId: string, hostId: string): Room {
    const room = ensureRoomExists(roomId);
    ensureHost(room, hostId);
    room.locked = false;
    const updated = roomStore.save(room);
    return toRoomDto(updated);
  },

  startGame(roomId: string, hostId: string) {
    const room = ensureRoomExists(roomId);
    ensureHost(room, hostId);
    if (!gameServiceRef) {
      throw new HttpError(500, 'server_error', 'Game service not initialized');
    }
    return gameServiceRef.startFromRoom(room);
  },

  fillWithBots(roomId: string, hostId: string): Room {
    const room = ensureRoomExists(roomId);
    ensureHost(room, hostId);

    if (room.status !== 'lobby') {
      throw new HttpError(403, 'forbidden', 'Can only add bots in lobby');
    }

    // Find empty seats
    const emptySeats = room.seats.filter((seat) => seat.playerId === null);

    if (emptySeats.length === 0) {
      throw new HttpError(409, 'conflict', 'No empty seats to fill');
    }

    // Create bots for empty seats
    for (const seat of emptySeats) {
      const bot = botService.createBot();
      seat.playerId = bot.userId;
      seat.ready = true; // Bots are always ready
    }

    const updated = roomStore.save(room);
    return toRoomDto(updated);
  },
};
