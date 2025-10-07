import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, queryKeys } from '../../api/client';
import SuitText from '../../components/SuitText';

interface CardPlayPanelProps {
  gameId: string;
  hand: string[];
  isMyTurn: boolean;
  stateVersion: number;
}

export const CardPlayPanel = ({ gameId, hand, isMyTurn, stateVersion }: CardPlayPanelProps) => {
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playCardMutation = useMutation({
    mutationFn: (card: string) =>
      apiFetch(`/games/${gameId}/turns/current/move`, {
        method: 'POST',
        body: {
          clientMoveId: `move_${Date.now()}`,
          moveType: 'play_card',
          payload: { card },
          stateVersion,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.privateHand(gameId, 'player1') });
      setSelectedCard(null);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handlePlayCard = () => {
    if (selectedCard) {
      playCardMutation.mutate(selectedCard);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Your Hand</h2>

      {error && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {!isMyTurn && (
        <div className="mt-4 rounded-lg bg-muted/60 p-3 text-center text-sm text-muted-foreground">
          Waiting for your turn...
        </div>
      )}

      <div className="mt-4 grid grid-cols-4 gap-2">
        {hand.map((card) => (
          <button
            key={card}
            type="button"
            onClick={() => setSelectedCard(card)}
            disabled={!isMyTurn || playCardMutation.isPending}
            className={`rounded-lg border px-3 py-4 text-lg font-semibold transition ${
              selectedCard === card
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted disabled:opacity-50'
            }`}
          >
            <SuitText text={card} />
          </button>
        ))}
      </div>

      {isMyTurn && selectedCard && (
        <button
          type="button"
          onClick={handlePlayCard}
          disabled={playCardMutation.isPending}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {playCardMutation.isPending ? 'Playing...' : `Play ${selectedCard}`}
        </button>
      )}
    </div>
  );
};
