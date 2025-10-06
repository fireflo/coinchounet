# Frontend Implementation Guide

## Overview

Complete React + TypeScript frontend for the Coinche card game, fully integrated with the backend API and Socket.IO real-time server.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **TanStack Query** for server state management
- **Socket.IO Client** for real-time updates
- **Zustand** for client state (if needed)
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Radix UI** for accessible components

## Project Structure

```
src/
├── api/
│   ├── client.ts          # API fetch wrapper
│   └── types.ts           # API type definitions
├── app/
│   └── AppLayout.tsx      # Main layout wrapper
├── features/
│   ├── auth/
│   │   └── Landing.tsx    # Landing page
│   ├── lobby/
│   │   └── LobbyPage.tsx  # Room list
│   ├── room/
│   │   └── RoomPage.tsx   # Room lobby (with Fill Bots button)
│   └── game/
│       ├── GameTablePage.tsx    # Main game UI
│       ├── BiddingPanel.tsx     # Bidding interface
│       └── CardPlayPanel.tsx    # Card play interface
├── realtime/
│   ├── SocketContext.tsx        # Socket.IO provider
│   └── useRealtimeGame.ts       # Game event hooks
├── styles/
│   └── index.css          # Global styles
├── main.tsx               # App entry point
└── router.tsx             # Route definitions
```

## Features Implemented

### 1. Room Page (`RoomPage.tsx`)

**Features:**
- ✅ View room details and seated players
- ✅ **Fill with Bots button** - Fills empty seats with AI players
- ✅ Toggle ready state
- ✅ Start game (host only)
- ✅ Copy invite link
- ✅ Real-time updates (5s polling + Socket.IO)

**Usage:**
```tsx
// Fill empty seats with bots
<button onClick={() => fillBotsMutation.mutate()}>
  🤖 Fill with Bots
</button>

// Start game when all ready
<button onClick={() => startGameMutation.mutate()}>
  Start Game
</button>
```

### 2. Bidding Panel (`BiddingPanel.tsx`)

**Features:**
- ✅ Select contract type (♣ ♦ ♥ ♠ NT AT)
- ✅ Set bid value (80-250 in increments of 10)
- ✅ Submit bid
- ✅ Pass
- ✅ Coinche (double)
- ✅ Shows current bid
- ✅ Disabled when not your turn

**API Calls:**
```typescript
POST /games/:gameId/bid
Body: { contractType: 'spades', value: 80 }

POST /games/:gameId/pass

POST /games/:gameId/coinche
```

### 3. Card Play Panel (`CardPlayPanel.tsx`)

**Features:**
- ✅ Display hand cards in grid
- ✅ Select card to play
- ✅ Play selected card
- ✅ Visual feedback (selected card highlighted)
- ✅ Disabled when not your turn
- ✅ Error handling

**API Calls:**
```typescript
POST /games/:gameId/turns/current/move
Body: {
  clientMoveId: 'move_123',
  moveType: 'play_card',
  payload: { card: 'A♠' },
  stateVersion: 5
}
```

### 4. Game Table Page (`GameTablePage.tsx`)

**Features:**
- ✅ 4-player table layout (North, South, East, West)
- ✅ Current trick display
- ✅ Player hands
- ✅ Scoreboard (Team A vs Team B)
- ✅ Contract display
- ✅ Turn order indicator
- ✅ Active player highlighting
- ✅ Conditional rendering (bidding vs card play)
- ✅ Real-time updates via Socket.IO

## Configuration

### Environment Variables

Create `.env` file:
```bash
VITE_API_BASE_URL=http://localhost:3001
```

### API Client

The `apiFetch` function automatically:
- Adds `Content-Type: application/json`
- Includes credentials (cookies)
- Handles errors
- Parses JSON responses

```typescript
// Example usage
const room = await apiFetch<Room>(`/rooms/${roomId}`);
const game = await apiFetch<GameState>(`/games/${gameId}`);
```

## Socket.IO Integration

### Connection

```typescript
// SocketContext.tsx
const socket = io('http://localhost:3001', {
  auth: { token: 'dev-user-player1' },
  transports: ['websocket', 'polling'],
});
```

### Event Listeners

```typescript
// useRealtimeGame.ts
socket.on('game:state_changed', (data) => {
  if (data.eventType === 'bid.placed') {
    // Refresh game state
  }
  if (data.eventType === 'contract.finalized') {
    // Switch to card play
  }
});

socket.on('game:move_accepted', (data) => {
  // Card was played
});

socket.on('game:turn_changed', (data) => {
  // Next player's turn
});
```

## Running the Frontend

### Development

```bash
# Install dependencies
npm install

# Start dev server (port 5173)
npm run dev

# In another terminal, start backend
cd server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## Complete User Flow

### 1. Create Room and Add Bots

```
1. Navigate to /lobby
2. Click "Create Room"
3. Enter room (e.g., /rooms/room_123)
4. Click "🤖 Fill with Bots"
   → All empty seats filled with AI players
5. Click "Start Game"
   → Redirects to /games/game_456
```

### 2. Bidding Phase

```
1. Game starts in bidding phase
2. BiddingPanel appears in sidebar
3. When it's your turn:
   - Select contract type (♠ ♥ ♦ ♣ NT AT)
   - Set bid value (80+)
   - Click "Bid" or "Pass"
4. Bots automatically bid/pass
5. After 3 passes or coinche:
   → Contract finalized
   → Switches to card play
```

### 3. Card Play Phase

```
1. CardPlayPanel replaces BiddingPanel
2. Your hand shows in grid
3. When it's your turn:
   - Click a card to select
   - Click "Play {card}"
4. Bots automatically play their cards
5. After 8 tricks:
   → Round scored
   → New round starts (back to bidding)
6. Game ends at 1000 points
```

## Styling

### Tailwind Classes

The app uses a consistent design system:

**Colors:**
- `bg-card` - Card backgrounds
- `bg-primary` - Primary actions
- `bg-muted` - Subtle backgrounds
- `text-muted-foreground` - Secondary text
- `border-border` - Borders

**Components:**
- Rounded corners: `rounded-xl`, `rounded-lg`
- Shadows: `shadow-sm`
- Spacing: `gap-4`, `p-6`, `mt-4`

### Custom Components

All components follow the same pattern:
- Semantic HTML
- Accessible (ARIA labels where needed)
- Responsive (mobile-first)
- Consistent spacing and typography

## State Management

### Server State (TanStack Query)

```typescript
// Fetch and cache game state
const { data: game } = useQuery({
  queryKey: queryKeys.game(gameId),
  queryFn: () => apiFetch<GameState>(`/games/${gameId}`),
  refetchInterval: 15_000, // Poll every 15s
});

// Mutations
const bidMutation = useMutation({
  mutationFn: (data) => apiFetch(`/games/${gameId}/bid`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
  },
});
```

### Real-time Updates

Socket.IO events trigger query invalidation:

```typescript
socket.on('game:state_changed', () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
});
```

## Error Handling

All mutations handle errors:

```typescript
const [error, setError] = useState<string | null>(null);

const mutation = useMutation({
  mutationFn: () => apiFetch(...),
  onError: (err: Error) => {
    setError(err.message);
  },
});

// Display error
{error && (
  <div className="text-destructive">{error}</div>
)}
```

## Testing

### Manual Testing

1. **Room Flow:**
   ```bash
   # Open http://localhost:5173/rooms/room_test
   # Click "Fill with Bots"
   # Verify 3 bots added
   # Click "Start Game"
   # Verify redirect to game page
   ```

2. **Bidding:**
   ```bash
   # In game, verify BiddingPanel shows
   # Select contract and value
   # Click "Bid"
   # Verify bots bid automatically
   # Verify contract finalized after 3 passes
   ```

3. **Card Play:**
   ```bash
   # After bidding, verify CardPlayPanel shows
   # Click a card
   # Click "Play"
   # Verify card appears in trick
   # Verify bots play automatically
   ```

### Browser DevTools

Check Network tab for API calls:
- `POST /rooms/:id/fill-bots` → 200
- `POST /rooms/:id/start` → 201
- `POST /games/:id/bid` → 200
- `POST /games/:id/turns/current/move` → 200

Check Console for Socket.IO events:
- `game:state_changed`
- `game:move_accepted`
- `game:turn_changed`

## Troubleshooting

### API Connection Issues

```bash
# Check backend is running
curl http://localhost:3001/health

# Check CORS headers
# Backend should allow origin: http://localhost:5173
```

### Socket.IO Not Connecting

```typescript
// Check connection in browser console
socket.on('connect', () => console.log('Connected'));
socket.on('connect_error', (err) => console.error('Error:', err));
```

### Bots Not Playing

```bash
# Check server logs
cd server
npm run dev
# Should see: "Bot bot_123 bidding..." or "Bot bot_123 playing..."
```

## Performance

### Optimizations

1. **Lazy Loading:** Routes are lazy-loaded
2. **Query Caching:** TanStack Query caches all API responses
3. **Polling:** Only active queries poll (15s interval)
4. **Socket.IO:** Real-time updates reduce polling need

### Bundle Size

```bash
npm run build
# Check dist/ folder size
# Should be < 500KB gzipped
```

## Next Steps

### Future Enhancements

1. **Authentication:**
   - Add OAuth login (Google, Facebook)
   - Store JWT token
   - Protected routes

2. **Lobby:**
   - List all public rooms
   - Filter by status
   - Search by room ID

3. **Game History:**
   - View completed games
   - Replay moves
   - Statistics

4. **Animations:**
   - Card play animations
   - Trick winner celebration
   - Score updates

5. **Mobile:**
   - Touch-friendly card selection
   - Responsive layout
   - PWA support

## Summary

Frontend complete with:
- ✅ Room management with bot filling
- ✅ Bidding interface
- ✅ Card play interface
- ✅ Real-time updates
- ✅ Error handling
- ✅ Responsive design
- ✅ Full backend integration

**Ready to play coinche with AI opponents!** 🎉
