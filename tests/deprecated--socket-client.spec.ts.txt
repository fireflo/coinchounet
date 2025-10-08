import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockSocket = {
  connected: boolean;
  connect: Mock<[], void>;
  disconnect: Mock<[], void>;
  on: Mock<[string, (payload: unknown) => void], void>;
  off: Mock<[string, (payload: unknown) => void], void>;
  emit: Mock<[string, unknown, ((...args: unknown[]) => void)?], void>;
  auth: Record<string, unknown>;
};

let mockSocket: MockSocket;

const createMockSocket = (): MockSocket => ({
  connected: false,
  connect: vi.fn<[], void>(() => {
    mockSocket.connected = true;
  }),
  disconnect: vi.fn<[], void>(() => {
    mockSocket.connected = false;
  }),
  on: vi.fn<[string, (payload: unknown) => void], void>(),
  off: vi.fn<[string, (payload: unknown) => void], void>(),
  emit: vi.fn<[string, unknown, ((...args: unknown[]) => void)?], void>(),
  auth: {},
});

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    mockSocket = createMockSocket();
    return mockSocket;
  }),
  __esModule: true,
}));

import { io } from 'socket.io-client';
import { createSocketClient } from '../src/realtime/socket';

describe('createSocketClient', () => {
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('connects with token only once and reuses the Socket.IO instance', async () => {
    const tokenProvider = vi.fn().mockResolvedValue('token-123');
    const client = createSocketClient({ baseUrl });

    await client.ensureConnected(tokenProvider);

    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith(baseUrl, expect.objectContaining({
      autoConnect: false,
      transports: ['websocket'],
      auth: { token: 'token-123' },
    }));
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);

    await client.ensureConnected(tokenProvider);
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    expect(tokenProvider).toHaveBeenCalledTimes(1);
  });

  it('joins a channel, registers handlers, and leaves via unsubscribe', async () => {
    const tokenProvider = vi.fn().mockResolvedValue('token-123');
    const client = createSocketClient({ baseUrl });
    await client.ensureConnected(tokenProvider);

    mockSocket.emit.mockImplementation((event: string, payload: unknown, ack?: (...args: unknown[]) => void) => {
      if (event === 'join') {
        ack?.({ ok: true });
      }
      if (event === 'leave') {
        ack?.({ ok: true });
      }
    });

    const handler = vi.fn();
    const unsubscribe = await client.joinChannel({
      channel: 'game:123',
      handlers: {
        'turn.move.accepted': handler,
      },
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join', { channel: 'game:123' }, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('turn.move.accepted', expect.any(Function));

    const wrappedHandler = mockSocket.on.mock.calls.find(([event]) => event === 'turn.move.accepted')?.[1] as (payload: unknown) => void;
    wrappedHandler?.({ stateVersion: 42 });
    expect(handler).toHaveBeenCalledWith({ stateVersion: 42 });

    await unsubscribe();
    expect(mockSocket.emit).toHaveBeenCalledWith('leave', { channel: 'game:123' }, expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('turn.move.accepted', wrappedHandler);
  });

  it('rejects when join acknowledgement times out', async () => {
    vi.useFakeTimers();
    const tokenProvider = vi.fn().mockResolvedValue('token-123');
    const client = createSocketClient({ baseUrl, ackTimeoutMs: 1500 });
    await client.ensureConnected(tokenProvider);

    mockSocket.emit.mockImplementation(() => void 0);

    const promise = client.joinChannel({ channel: 'game:123', handlers: {} });
    await vi.advanceTimersByTimeAsync(1500);

    await expect(promise).rejects.toThrowError('Timed out waiting for join acknowledgement for channel game:123');
  });

  it('exposes emitWithAck for move submission acknowledgements', async () => {
    vi.useFakeTimers();
    const tokenProvider = vi.fn().mockResolvedValue('token-123');
    const client = createSocketClient({ baseUrl, ackTimeoutMs: 2_000 });
    await client.ensureConnected(tokenProvider);

    mockSocket.emit.mockImplementation((event: string, payload: unknown, ack?: (...args: unknown[]) => void) => {
      if (event === 'move.submit') {
        setTimeout(() => ack?.({ accepted: true, stateVersion: 44 }), 500);
      }
    });

    const responsePromise = client.emitWithAck('move.submit', { card: 'J♠' });
    await vi.advanceTimersByTimeAsync(500);
    await expect(responsePromise).resolves.toEqual({ accepted: true, stateVersion: 44 });
  });
});
