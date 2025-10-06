import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, queryKeys } from '../../api/client';
import type { Room, GameState } from '../../api/types';
import { useState } from 'react';

const SeatCard = ({ seat, index }: { seat: Room['seats'][number]; index: number }) => {
  const occupied = Boolean(seat.playerId);
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Seat {index + 1}</span>
        <span>{seat.ready ? 'Ready' : 'Not ready'}</span>
      </div>
      <div className="mt-2 text-lg font-semibold">
        {occupied ? seat.playerId : <span className="text-muted-foreground">Empty seat</span>}
      </div>
    </div>
  );
};

const RoomPage = () => {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    data: room,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.room(roomId),
    queryFn: () => apiFetch<Room>(`/rooms/${roomId}`),
    enabled: Boolean(roomId),
    refetchInterval: 5_000,
  });

  const fillBotsMutation = useMutation({
    mutationFn: () => apiFetch<Room>(`/rooms/${roomId}/fill-bots`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) });
      setErrorMsg(null);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
    },
  });

  const toggleReadyMutation = useMutation({
    mutationFn: (ready: boolean) =>
      apiFetch<Room>(`/rooms/${roomId}/ready`, {
        method: 'POST',
        body: JSON.stringify({ ready }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) });
    },
  });

  const startGameMutation = useMutation({
    mutationFn: () => apiFetch<GameState>(`/rooms/${roomId}/start`, { method: 'POST' }),
    onSuccess: (gameState) => {
      navigate(`/games/${gameState.gameId}`);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading room…</div>;
  }

  if (error || !room) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load room {roomId}. {(error as Error)?.message}
      </div>
    );
  }

  const filledSeats = room.seats.filter((seat) => seat.playerId).length;
  const allReady = room.seats.every((seat) => seat.playerId && seat.ready);

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Room {room.roomId}</h1>
          <p className="text-sm text-muted-foreground">
            Host: <span className="font-medium text-foreground">{room.hostId}</span> · {filledSeats}/{room.maxSeats} seats filled
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div>
            Status:{' '}
            <span className="font-medium capitalize text-foreground">{room.status.replace('_', ' ')}</span>
          </div>
          <div>
            Ready check:{' '}
            <span className={`font-semibold ${allReady ? 'text-success' : 'text-muted-foreground'}`}>
              {allReady ? 'All players ready' : 'Waiting on players'}
            </span>
          </div>
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {room.seats.map((seat, index) => (
          <SeatCard key={seat.index} seat={seat} index={index} />
        ))}
      </div>
      {errorMsg && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}
      <footer className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => toggleReadyMutation.mutate(!room.seats.find(s => s.playerId === 'player1')?.ready)}
          disabled={toggleReadyMutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {toggleReadyMutation.isPending ? 'Loading...' : 'Toggle Ready'}
        </button>
        <button
          type="button"
          onClick={() => fillBotsMutation.mutate()}
          disabled={fillBotsMutation.isPending || room.status !== 'lobby'}
          className="rounded-md border border-border bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {fillBotsMutation.isPending ? 'Adding Bots...' : '🤖 Fill with Bots'}
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground"
        >
          Copy Invite Link
        </button>
        <button
          type="button"
          onClick={() => startGameMutation.mutate()}
          disabled={startGameMutation.isPending || !allReady || room.status !== 'lobby'}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
        >
          {startGameMutation.isPending ? 'Starting...' : 'Start Game'}
        </button>
      </footer>
    </section>
  );
};

export default RoomPage;
