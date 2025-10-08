import { randomUUID } from 'node:crypto';
import type { Room } from '../types/api.js';
import type { CreateRoomInput, RoomEntity, RoomFilters } from '../types/domain.js';

const rooms = new Map<string, RoomEntity>();

const cloneRoom = (room: RoomEntity): RoomEntity => ({
  ...room,
  seats: room.seats.map((seat) => ({ ...seat })),
  metadata: room.metadata ? { ...room.metadata } : undefined,
});

const generateRoomId = () => `room_${randomUUID().slice(0, 8)}`;

export const roomStore = {
  create(input: CreateRoomInput): RoomEntity {
    const createdAt = new Date().toISOString();
    const roomId = generateRoomId();
    const seats: Room['seats'] = Array.from({ length: input.maxSeats }, (_, index) => ({
      index,
      playerId: null,
      ready: false,
    }));

    if (seats.length > 0) {
      seats[0].playerId = input.hostId;
    }

    const room: RoomEntity = {
      roomId,
      gameType: input.gameType,
      maxSeats: input.maxSeats,
      status: 'lobby',
      hostId: input.hostId,
      seats,
      metadata: input.metadata,
      createdAt,
      visibility: input.visibility,
      rulesetVersion: input.rulesetVersion,
      locked: false,
    };

    rooms.set(roomId, room);
    return cloneRoom(room);
  },

  findById(roomId: string): RoomEntity | null {
    const room = rooms.get(roomId);
    return room ? cloneRoom(room) : null;
  },

  save(room: RoomEntity): RoomEntity {
    rooms.set(room.roomId, cloneRoom(room));
    return cloneRoom(room);
  },

  list(filters: RoomFilters = {}): { items: RoomEntity[]; total: number } {
    let list = Array.from(rooms.values(), cloneRoom);

    if (filters.gameType) {
      list = list.filter((room) => room.gameType === filters.gameType);
    }
    if (filters.visibility) {
      list = list.filter((room) => room.visibility === filters.visibility);
    }
    if (filters.status) {
      list = list.filter((room) => room.status === filters.status);
    }

    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 200);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: list.slice(start, end),
      total: list.length,
    };
  },

  clear(): void {
    rooms.clear();
  },
};
