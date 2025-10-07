import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, queryKeys } from '../../api/client';
import SuitText from '../../components/SuitText';

interface BiddingPanelProps {
  gameId: string;
  isMyTurn: boolean;
  currentBid: { value: number; contractType: string } | null;
}

const CONTRACT_TYPES = [
  { value: 'clubs', label: '♣ Clubs', symbol: '♣' },
  { value: 'diamonds', label: '♦ Diamonds', symbol: '♦' },
  { value: 'hearts', label: '♥ Hearts', symbol: '♥' },
  { value: 'spades', label: '♠ Spades', symbol: '♠' },
  { value: 'no_trump', label: 'No Trump', symbol: 'NT' },
  { value: 'all_trump', label: 'All Trump', symbol: 'AT' },
];

export const BiddingPanel = ({ gameId, isMyTurn, currentBid }: BiddingPanelProps) => {
  const queryClient = useQueryClient();
  const [selectedContract, setSelectedContract] = useState<string>('spades');
  const [bidValue, setBidValue] = useState<number>(80);
  const [error, setError] = useState<string | null>(null);

  const bidMutation = useMutation({
    mutationFn: ({ contractType, value }: { contractType: string; value: number }) =>
      apiFetch(`/games/${gameId}/bid`, {
        method: 'POST',
        body: { contractType, value },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const passMutation = useMutation({
    mutationFn: () => apiFetch(`/games/${gameId}/pass`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const coincheMutation = useMutation({
    mutationFn: () => apiFetch(`/games/${gameId}/coinche`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleBid = () => {
    bidMutation.mutate({ contractType: selectedContract, value: bidValue });
  };

  const handlePass = () => {
    passMutation.mutate();
  };

  const handleCoinche = () => {
    coincheMutation.mutate();
  };

  const minBid = currentBid ? currentBid.value + 10 : 80;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Bidding Phase</h2>

      {currentBid && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="text-sm text-muted-foreground">Current Bid</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xl font-semibold">{currentBid.value}</span>
            <span className="text-sm uppercase tracking-wide">{currentBid.contractType.replace('_', ' ')}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {!isMyTurn && (
        <div className="mt-4 rounded-lg bg-muted/60 p-3 text-center text-sm text-muted-foreground">
          Waiting for other players to bid...
        </div>
      )}

      {isMyTurn && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Contract Type</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CONTRACT_TYPES.map((contract) => (
                <button
                  key={contract.value}
                  type="button"
                  onClick={() => setSelectedContract(contract.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    selectedContract === contract.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  <SuitText text={contract.symbol} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Bid Value</label>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBidValue(Math.max(minBid, bidValue - 10))}
                className="rounded-md border border-border px-3 py-1 text-sm font-semibold"
              >
                -10
              </button>
              <input
                type="number"
                value={bidValue}
                onChange={(e) => setBidValue(Number(e.target.value))}
                min={minBid}
                step={10}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-center text-sm font-semibold"
              />
              <button
                type="button"
                onClick={() => setBidValue(bidValue + 10)}
                className="rounded-md border border-border px-3 py-1 text-sm font-semibold"
              >
                +10
              </button>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Minimum: {minBid}</div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBid}
              disabled={bidMutation.isPending || bidValue < minBid}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {bidMutation.isPending ? 'Bidding...' : 'Bid'}
            </button>
            <button
              type="button"
              onClick={handlePass}
              disabled={passMutation.isPending}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {passMutation.isPending ? 'Passing...' : 'Pass'}
            </button>
          </div>

          {currentBid && (
            <button
              type="button"
              onClick={handleCoinche}
              disabled={coincheMutation.isPending}
              className="w-full rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-50"
            >
              {coincheMutation.isPending ? 'Coinching...' : 'Coinche (Double)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
