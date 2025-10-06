import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

export type TokenProvider = () => Promise<string> | string;

export type SocketClientOptions = {
  baseUrl: string;
  ackTimeoutMs?: number;
};

type HandlerMap = Record<string, (payload: unknown) => void>;

type JoinParams = {
  channel: string;
  handlers: HandlerMap;
};

export type SocketClient = {
  ensureConnected: (tokenProvider: TokenProvider) => Promise<void>;
  joinChannel: (params: JoinParams) => Promise<() => Promise<void>>;
  emitWithAck: <TResponse = unknown>(
    event: string,
    payload: unknown,
  ) => Promise<TResponse>;
};

const createAckPromise = <T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs: number,
  actionDescription: string,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const ack = (response: T) => {
      if (timer) {
        clearTimeout(timer);
      }
      resolve(response);
    };

    timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${actionDescription}`));
    }, timeoutMs);

    socket.emit(event, payload, ack);
  });

export const createSocketClient = (
  options: SocketClientOptions,
): SocketClient => {
  const ackTimeoutMs = options.ackTimeoutMs ?? 3000;
  let socket: Socket | undefined;
  let connecting = false;

  const ensureSocket = async (tokenProvider: TokenProvider) => {
    if (socket?.connected) {
      return socket;
    }

    if (!socket && !connecting) {
      connecting = true;
      try {
        const token = await tokenProvider();
        socket = io(options.baseUrl, {
          autoConnect: false,
          transports: ['websocket'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 500,
          reconnectionDelayMax: 5000,
        });
      } finally {
        connecting = false;
      }
    }

    if (!socket) {
      throw new Error('Socket.IO client failed to initialize');
    }

    if (!socket.connected) {
      socket.auth = { token: await tokenProvider() };
      socket.connect();
    }

    return socket;
  };

  const joinChannelInternal = async (
    socketInstance: Socket,
    params: JoinParams,
  ) => {
    const cleanupFns: Array<() => void> = [];

    const joinPromise = createAckPromise(socketInstance, 'join', { channel: params.channel }, ackTimeoutMs, `join acknowledgement for channel ${params.channel}`);
    const handlers = Object.entries(params.handlers);

    handlers.forEach(([event, handler]) => {
      const wrapped = (payload: unknown) => handler(payload);
      cleanupFns.push(() => socketInstance.off(event, wrapped));
      socketInstance.on(event, wrapped);
    });

    await joinPromise;

    return async () => {
      await createAckPromise(socketInstance, 'leave', { channel: params.channel }, ackTimeoutMs, `leave acknowledgement for channel ${params.channel}`);
      cleanupFns.forEach((fn) => fn());
    };
  };

  return {
    ensureConnected: async (tokenProvider: TokenProvider) => {
      await ensureSocket(tokenProvider);
    },
    joinChannel: async (params: JoinParams) => {
      if (!socket || !socket.connected) {
        throw new Error('Socket.IO client not initialized; call ensureConnected first');
      }

      return joinChannelInternal(socket, params);
    },
    emitWithAck: async <TResponse = unknown>(event: string, payload: unknown) => {
      if (!socket) {
        throw new Error('Socket.IO client not initialized; call ensureConnected first');
      }

      return createAckPromise<TResponse>(socket, event, payload, ackTimeoutMs, `${event} acknowledgement`);
    },
  };
};
