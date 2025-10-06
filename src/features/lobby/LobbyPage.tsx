import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, queryKeys } from '../../api/client';
import type { PaginatedRooms, Room } from '../../api/types';
import { useState } from 'react';

const LobbyPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.rooms(),
    queryFn: () => apiFetch<PaginatedRooms>('/rooms?gameType=coinche&status=lobby'),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const createRoomMutation = useMutation({
    mutationFn: () =>
      apiFetch<Room>('/rooms', {
        method: 'POST',
        body: {
          gameType: 'coinche',
          maxSeats: 4,
          visibility: 'public',
          rulesetVersion: '2024.09',
        },
      }),
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms() });
      navigate(`/rooms/${room.roomId}`);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading rooms…</div>;
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load rooms: {(error as Error).message}
      </div>
    );
  }

  const rooms = data?.items ?? [];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Open Lobbies</h1>
        <button
          type="button"
          onClick={() => createRoomMutation.mutate()}
          disabled={createRoomMutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createRoomMutation.isPending ? 'Creating...' : 'Create Room'}
        </button>
      </div>
      {errorMsg && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Seats</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card text-sm">
            {rooms.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                  No rooms are currently open. Be the first to create one!
                </td>
              </tr>
            )}
            {rooms.map((room) => (
              <tr key={room.roomId}>
                <td className="px-4 py-3 font-medium">{room.roomId}</td>
                <td className="px-4 py-3">
                  {room.seats.filter((seat) => seat.playerId).length}/{room.maxSeats}
                </td>
                <td className="px-4 py-3 capitalize">{room.status.replace('_', ' ')}</td>
                <td className="px-4 py-3">
                  <Link
                    to={`/rooms/${room.roomId}`}
                    className="inline-flex items-center rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                  >
                    Join
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default LobbyPage;
