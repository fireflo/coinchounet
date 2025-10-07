import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, queryKeys } from '../../api/client';
import type { GameState, PrivateHand, TurnMetadata } from '../../api/types';
import SuitText from '../../components/SuitText';
import { DEV_PLAYER_ID, useRealtimeGame } from '../../realtime/useRealtimeGame';
import { BiddingPanel } from './BiddingPanel';
import { CardPlayPanel } from './CardPlayPanel';

const PlayerSeat = ({
  label,
  playerId,
  active,
}: {
  label: string;
  playerId?: string | null;
  active: boolean;
}) => (
  <div className={`flex flex-col items-center gap-1 ${active ? 'text-primary' : 'text-muted-foreground'}`}>
    <span className="text-[11px] uppercase tracking-wide">{label}</span>
    <div
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/40 text-foreground'
      }`}
    >
      {playerId ?? '—'}
    </div>
  </div>
);

const CardPill = ({ card }: { card: string }) => (
  <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold shadow-sm">
    <SuitText text={card} />
  </div>
);

const TrickCard = ({ playerId, card, isWinner }: { playerId: string; card: string; isWinner: boolean }) => (
  <div
    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
      isWinner ? 'border-success text-success' : 'border-border bg-muted/40'
    }`}
  >
    <span>{playerId}</span>
  <span className="font-semibold"><SuitText text={card} /></span>
  </div>
);

const GameTablePage = () => {
  const { gameId = '' } = useParams();

  useRealtimeGame(gameId);

  const { data: gameState, isLoading } = useQuery({
    queryKey: queryKeys.game(gameId),
    queryFn: () => apiFetch<GameState>(`/games/${gameId}`),
    enabled: Boolean(gameId),
    refetchInterval: 15_000,
  });

  const { data: turnMeta } = useQuery({
    queryKey: gameId ? queryKeys.turn(gameId) : ['turn', 'noop'],
    queryFn: () => apiFetch<TurnMetadata>(`/games/${gameId}/turns/current`),
    enabled: Boolean(gameId),
    refetchInterval: 10_000,
  });

  const { data: privateHand } = useQuery({
    queryKey: gameId ? queryKeys.privateHand(gameId, DEV_PLAYER_ID) : ['hand', 'noop'],
    queryFn: () => apiFetch<PrivateHand>(`/games/${gameId}/me/hand`),
    enabled: Boolean(gameId),
  });

  // Move all useMemo/useState/useEffect BEFORE early returns
  const turnOrder = gameState?.turnOrder ?? [];
  const arrangedOrder = useMemo(() => {
    if (!turnOrder.length) {
      return [] as string[];
    }
    const selfIndex = turnOrder.indexOf(DEV_PLAYER_ID);
    if (selfIndex === -1) {
      return turnOrder;
    }
    return [...turnOrder.slice(selfIndex), ...turnOrder.slice(0, selfIndex)];
  }, [turnOrder]);

  // Early return AFTER all hooks
  if (isLoading || !gameState) {
    return <div className="text-muted-foreground">Loading table…</div>;
  }

  const { score, contracts, publicContainers } = gameState;
  const currentTrick = publicContainers.currentTrick?.order ?? [];

  const seats = {
    south: arrangedOrder[0] ?? null,
    west: arrangedOrder[1] ?? null,
    north: arrangedOrder[2] ?? null,
    east: arrangedOrder[3] ?? null,
  };

  const activePlayer = turnMeta?.activePlayerId ?? null;
  const handCards = privateHand?.cards ?? [];
  const topRow = handCards.slice(0, Math.ceil(handCards.length / 2));
  const bottomRow = handCards.slice(Math.ceil(handCards.length / 2));
  
  const isMyTurn = activePlayer === DEV_PLAYER_ID;
  const isBiddingPhase = turnMeta?.legalMoveTypes?.includes('bid') || turnMeta?.legalMoveTypes?.includes('pass');
  const isCardPlayPhase = turnMeta?.legalMoveTypes?.includes('play_card');
  
  const currentBid = gameState.contracts.length > 0 
    ? { value: gameState.contracts[0].value, contractType: gameState.contracts[0].type }
    : null;

  return (
    <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid min-h-[420px] grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] gap-6">
          <div className="col-span-3 flex justify-center">
            <PlayerSeat label="North" playerId={seats.north} active={activePlayer === seats.north} />
          </div>
          <div className="flex items-center justify-end">
            <PlayerSeat label="West" playerId={seats.west} active={activePlayer === seats.west} />
          </div>
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-6">
            <h3 className="text-lg font-semibold">Current Trick</h3>
            {currentTrick.length === 0 ? (
              <p className="text-sm text-muted-foreground">Waiting for the first card…</p>
            ) : (
              <div className="w-full space-y-2 text-sm">
                {currentTrick.map(({ playerId, card }, index) => (
                  <TrickCard
                    key={`${playerId}-${card}-${index}`}
                    playerId={playerId}
                    card={card}
                    isWinner={turnMeta?.activePlayerId === playerId && index === currentTrick.length - 1}
                  />
                ))}
              </div>
            )}
            <div className="grid w-full grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="rounded border border-border/60 bg-background p-2 text-center">
                Draw pile:{' '}
                <span className="font-semibold text-foreground">{publicContainers.drawPileCount ?? '—'}</span>
              </div>
              <div className="rounded border border-border/60 bg-background p-2 text-center">
                Discard top:{' '}
                <span className="font-semibold text-foreground">{publicContainers.discardPileTop ?? '—'}</span>
              </div>
              <div className="rounded border border-border/60 bg-background p-2 text-center">
                Tricks won:{' '}
                <span className="font-semibold text-foreground">{publicContainers.trickHistoryCount ?? 0}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <PlayerSeat label="East" playerId={seats.east} active={activePlayer === seats.east} />
          </div>
          <div className="col-span-3 flex flex-col items-center gap-3">
            <PlayerSeat label="South (You)" playerId={seats.south ?? DEV_PLAYER_ID} active={activePlayer === seats.south} />
            <div className="w-full space-y-2">
              <div className="flex flex-wrap justify-center gap-2">
                {topRow.map((card) => (
                  <CardPill key={`top-${card}`} card={card} />
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {bottomRow.map((card) => (
                  <CardPill key={`bottom-${card}`} card={card} />
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <aside className="space-y-6">
        {isBiddingPhase && (
          <BiddingPanel
            gameId={gameId}
            isMyTurn={isMyTurn}
            currentBid={currentBid}
          />
        )}
        
        {isCardPlayPhase && (
          <CardPlayPanel
            gameId={gameId}
            hand={handCards}
            isMyTurn={isMyTurn}
            stateVersion={gameState.stateVersion}
          />
        )}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Scoreboard</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-muted-foreground">Team A</p>
              <p className="text-2xl font-semibold">{score.teamA}</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-muted-foreground">Team B</p>
              <p className="text-2xl font-semibold">{score.teamB}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Scores include coinche/surcoinche multipliers and dix de der bonuses according to the active ruleset.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Contract & Bids</h2>
          {contracts.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Bidding has not been resolved for this deal.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {contracts.map((contract, index) => (
                <li key={`${contract.team}-${index}`} className="rounded-lg border border-border/60 bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase">{contract.team}</span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{contract.type}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-lg font-semibold">{contract.value}</span>
                    <div className="flex gap-2 text-[11px] uppercase">
                      {contract.coinched && <span className="rounded bg-primary/20 px-2 py-0.5">Coinche</span>}
                      {contract.surcoinched && <span className="rounded bg-accent/20 px-2 py-0.5">Surcoinche</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {turnMeta?.deadline && (
            <p className="mt-3 text-xs text-muted-foreground">Turn deadline: {new Date(turnMeta.deadline).toLocaleString()}</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm text-sm">
          <h2 className="text-lg font-semibold">Turn Order</h2>
          <ol className="mt-3 space-y-2">
            {turnOrder.map((playerId) => (
              <li
                key={playerId}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  activePlayer === playerId ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30'
                }`}
              >
                <span>{playerId}</span>
                {activePlayer === playerId && <span className="text-xs uppercase">Acting</span>}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </section>
  );
};

export default GameTablePage;
