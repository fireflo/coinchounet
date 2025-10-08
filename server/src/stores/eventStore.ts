import { randomUUID } from 'node:crypto';
import type { GameEventEnvelope } from '../types/domain.js';

const events = new Map<string, GameEventEnvelope[]>();

const cloneEvent = (event: GameEventEnvelope): GameEventEnvelope => ({
  eventId: event.eventId,
  eventType: event.eventType,
  occurredAt: event.occurredAt,
  source: event.source,
  gameId: event.gameId,
  payload: { ...event.payload },
});

const createEventId = () => `evt_${randomUUID().slice(0, 12)}`;

export const eventStore = {
  append(gameId: string, eventType: string, payload: Record<string, unknown>, source = 'game'): GameEventEnvelope {
    const event: GameEventEnvelope = {
      eventId: createEventId(),
      eventType,
      occurredAt: new Date().toISOString(),
      source,
      gameId,
      payload,
    };
    const list = events.get(gameId) ?? [];
    list.push(event);
    events.set(gameId, list);
    return cloneEvent(event);
  },

  list(gameId: string, after?: string | null): GameEventEnvelope[] {
    const list = events.get(gameId) ?? [];
    if (!after) {
      return list.map(cloneEvent);
    }
    const index = list.findIndex((evt) => evt.eventId === after);
    if (index === -1) {
      return list.map(cloneEvent);
    }
    return list.slice(index + 1).map(cloneEvent);
  },

  clear(gameId?: string): void {
    if (gameId) {
      events.delete(gameId);
      return;
    }
    events.clear();
  },
};
