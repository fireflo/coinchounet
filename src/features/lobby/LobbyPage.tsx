import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch, queryKeys } from '../../api/client';
import type { PaginatedRooms } from '../../api/types';

const LobbyPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.rooms(),
    queryFn: () => apiFetch<PaginatedRooms>('/rooms?gameType=coinche&status=lobby'),
    staleTime: 10_000,
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
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Create Room
        </button>
      </div>
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
