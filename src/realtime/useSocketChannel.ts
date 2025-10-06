import { useEffect, useMemo } from 'react';
import { useSocket } from './SocketContext';

type HandlerMap = Record<string, (payload: unknown) => void>;

type Options = {
  channel: string | null | undefined;
  handlers: HandlerMap;
};

export const useSocketChannel = ({ channel, handlers }: Options) => {
  const { joinChannel } = useSocket();

  const stableHandlers = useMemo(() => handlers, [handlers]);

  useEffect(() => {
    if (!channel) {
      return undefined;
    }

    let unsubscribe: (() => Promise<void>) | undefined;

    const connect = async () => {
      try {
        unsubscribe = await joinChannel({ channel, handlers: stableHandlers });
      } catch (error) {
        console.error(`Failed to join channel ${channel}`, error);
      }
    };

    void connect();

    return () => {
      if (unsubscribe) {
        void unsubscribe();
      }
    };
  }, [channel, joinChannel, stableHandlers]);
};
