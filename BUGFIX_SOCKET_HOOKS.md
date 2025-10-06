# Bug Fix: Socket.IO and React Hooks Issues

## Issues Found

When starting a game, multiple errors occurred:

1. **Socket.IO client failed to initialize**
2. **React Hooks order violation in GameTablePage**
3. **Socket channel join timeout**

## Root Causes

### 1. Socket.IO Connection Issues

**Problem:** Socket client was using wrong URL and token

```typescript
// Before (wrong)
const SOCKET_BASE_URL = 'https://api.example.com/v1';  // ❌ Wrong default
const DEV_TOKEN = 'dev-token';  // ❌ Wrong format
```

**Solution:** Use correct defaults

```typescript
// After (fixed)
const SOCKET_BASE_URL = 'http://localhost:3001';  // ✅ Correct
const DEV_TOKEN = 'dev-user-player1';  // ✅ Matches backend auth
```

### 2. React Hooks Order Violation

**Problem:** `useMemo` was called AFTER an early return, violating Rules of Hooks

```typescript
// Before (broken)
const GameTablePage = () => {
  useQuery(...);  // Hook 1
  useQuery(...);  // Hook 2
  useQuery(...);  // Hook 3
  
  if (isLoading) {
    return <div>Loading...</div>;  // ❌ Early return
  }
  
  const arrangedOrder = useMemo(...);  // ❌ Hook called conditionally!
}
```

**Error:**
```
Warning: React has detected a change in the order of Hooks called by GameTablePage.
Error: Rendered more hooks than during the previous render.
```

**Solution:** Move all hooks BEFORE early returns

```typescript
// After (fixed)
const GameTablePage = () => {
  useQuery(...);  // Hook 1
  useQuery(...);  // Hook 2
  useQuery(...);  // Hook 3
  
  const turnOrder = gameState?.turnOrder ?? [];  // Safe access
  const arrangedOrder = useMemo(...);  // ✅ Hook always called
  
  if (isLoading) {
    return <div>Loading...</div>;  // ✅ Early return AFTER hooks
  }
}
```

### 3. Socket Channel Join Timeout

**Problem:** Frontend sends generic `join` event, but backend only handled specific events

```typescript
// Frontend sends:
socket.emit('join', { channel: 'game:xxx:public' }, callback);

// Backend only handled:
socket.on('game:join', ...)  // ❌ Different event name!
socket.on('room:join', ...)
```

**Error:**
```
Failed to join channel game:game_1b66f73d:public
Error: Timed out waiting for join acknowledgement
```

**Solution:** Add generic join/leave handlers to backend

```typescript
// Backend now handles:
socket.on('join', (payload: { channel: string }, callback) => {
  socket.join(payload.channel);
  callback({ ok: true });
});

socket.on('leave', (payload: { channel: string }, callback) => {
  socket.leave(payload.channel);
  callback({ ok: true });
});
```

## Files Fixed

### Frontend

1. **`src/features/game/GameTablePage.tsx`**
   - Moved `useMemo` before early return
   - Used safe access (`gameState?.turnOrder ?? []`)

2. **`src/realtime/SocketContext.tsx`**
   - Fixed default Socket.IO URL
   - Fixed dev token format

### Backend

3. **`server/src/realtime/socketServer.ts`**
   - Added generic `join` event handler
   - Added generic `leave` event handler
   - Updated TypeScript interfaces

## Test Results

```bash
# Backend tests
npm test socket.spec.ts
✓ tests/socket.spec.ts (10 tests) ✅

# All tests
npm test
Test Files  8 passed (8)
Tests  69 passed (69) ✅
```

## How to Verify

### Before Fix

```bash
# Start backend
cd server && npm run dev

# Start frontend
npm run dev

# Navigate to game page
# Result: Multiple errors in console:
# - Socket.IO client failed to initialize
# - React Hooks order violation
# - Socket channel join timeout
```

### After Fix

```bash
# Start backend
cd server && npm run dev

# Start frontend
npm run dev

# Navigate to game page
# Result: ✅ No errors, game loads successfully
```

## React Hooks Rules

**Golden Rule:** Hooks must be called in the same order on every render

✅ **Correct:**
```typescript
function Component() {
  const [state, setState] = useState();  // Always called
  const value = useMemo(() => ...);      // Always called
  
  if (condition) {
    return <div>Early</div>;  // OK - after all hooks
  }
  
  return <div>Normal</div>;
}
```

❌ **Wrong:**
```typescript
function Component() {
  const [state, setState] = useState();
  
  if (condition) {
    return <div>Early</div>;  // ❌ Early return
  }
  
  const value = useMemo(() => ...);  // ❌ Conditionally called!
  return <div>Normal</div>;
}
```

## Socket.IO Event Flow

### Frontend → Backend

```typescript
// Frontend (socket.ts)
socket.emit('join', { channel: 'game:123:public' }, (response) => {
  if (response.ok) {
    // Joined successfully
  }
});

// Backend (socketServer.ts)
socket.on('join', (payload, callback) => {
  socket.join(payload.channel);
  callback({ ok: true });
});
```

### Backend → Frontend

```typescript
// Backend broadcasts
io.to('game:123:public').emit('game:state_changed', { ... });

// Frontend receives
socket.on('game:state_changed', (data) => {
  // Handle event
});
```

## Summary

- ✅ Fixed Socket.IO URL and token
- ✅ Fixed React Hooks order violation
- ✅ Added generic join/leave handlers
- ✅ All 69 tests passing
- ✅ Game page loads without errors

**The game now works end-to-end!** 🎉
