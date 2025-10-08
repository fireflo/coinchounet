import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { createSocketClient, type SocketClient } from './socket';

type SocketContextValue = {
  ensureConnected: () => Promise<void>;
  joinChannel: SocketClient['joinChannel'];
  emitWithAck: SocketClient['emitWithAck'];
};

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const DEV_TOKEN = 'dev-user-player1';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const clientRef = useRef<SocketClient>(null);

  if (!clientRef.current) {
    clientRef.current = createSocketClient({
      baseUrl: SOCKET_BASE_URL.replace(/\/?$/, ''),
      ackTimeoutMs: 3_000,
    });
  }

  const tokenProvider = useCallback(async () => DEV_TOKEN, []);

  const ensureConnected = useCallback(async () => {
    await clientRef.current?.ensureConnected(tokenProvider);
  }, [tokenProvider]);

  useEffect(() => {
    ensureConnected().catch((error) => {
      console.error('Socket connection failed', error);
    });
  }, [ensureConnected]);

  const joinChannel = useCallback<SocketClient['joinChannel']>(
    async (params) => {
      await ensureConnected();
      return clientRef.current!.joinChannel(params);
    },
    [ensureConnected],
  );

  const emitWithAck = useCallback<SocketClient['emitWithAck']>(
    async (event, payload) => {
      await ensureConnected();
      return clientRef.current!.emitWithAck(event, payload);
    },
    [ensureConnected],
  );

  const value = useMemo<SocketContextValue>(
    () => ({ ensureConnected, joinChannel, emitWithAck }),
    [ensureConnected, joinChannel, emitWithAck],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
