import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PrivateHand } from '../api/types';
import { queryKeys } from '../api/client';
import { useSocketChannel } from './useSocketChannel';

export const DEV_PLAYER_ID = 'user_dev';

export const useRealtimeGame = (gameId?: string | null) => {
  const queryClient = useQueryClient();

  const publicHandlers = useMemo<Record<string, (payload: unknown) => void>>(() => {
    if (!gameId) {
      return {} as Record<string, (payload: unknown) => void>;
    }
    const invalidateGame = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.turn(gameId) });
    };
    return {
      'turn.move.accepted': invalidateGame,
      'turn.move.rejected': invalidateGame,
      'turn.changed': invalidateGame,
      'game.updated': invalidateGame,
    } satisfies Record<string, (payload: unknown) => void>;
  }, [gameId, queryClient]);

  useSocketChannel({
    channel: gameId ? `game:${gameId}:public` : null,
    handlers: publicHandlers,
  });

  const privateHandlers = useMemo<Record<string, (payload: unknown) => void>>(() => {
    if (!gameId) {
      return {} as Record<string, (payload: unknown) => void>;
    }
    const updateHand = (payload: unknown) => {
      queryClient.setQueryData(queryKeys.privateHand(gameId, DEV_PLAYER_ID), payload as PrivateHand);
    };
    return {
      'player.hand.dealt': updateHand,
      'player.hand.updated': updateHand,
    } satisfies Record<string, (payload: unknown) => void>;
  }, [gameId, queryClient]);

  useSocketChannel({
    channel: gameId ? `game:${gameId}:private:${DEV_PLAYER_ID}` : null,
    handlers: privateHandlers,
  });
};
