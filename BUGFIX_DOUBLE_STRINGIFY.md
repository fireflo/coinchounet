# Bug Fix: Double JSON Stringify

## Issue

The "Create Room" button in the frontend was causing a server error:

```
SyntaxError: Unexpected token '"', ""{\"gameTy"... is not valid JSON
```

## Root Cause

The frontend code was calling `JSON.stringify()` on the body before passing it to `apiFetch()`, which then called `JSON.stringify()` again internally. This resulted in double-stringified JSON being sent to the server.

### Before (Broken)

```typescript
// LobbyPage.tsx
apiFetch<Room>('/rooms', {
  method: 'POST',
  body: JSON.stringify({  // ❌ Wrong! Already stringifying here
    gameType: 'coinche',
    maxSeats: 4,
    visibility: 'public',
    rulesetVersion: '2024.09',
  }),
})

// apiFetch internally does:
body: body ? JSON.stringify(body) : undefined  // Stringifies again!
```

Result: `""{\"gameType\":\"coinche\",...}""` (double-quoted string)

### After (Fixed)

```typescript
// LobbyPage.tsx
apiFetch<Room>('/rooms', {
  method: 'POST',
  body: {  // ✅ Correct! Pass object directly
    gameType: 'coinche',
    maxSeats: 4,
    visibility: 'public',
    rulesetVersion: '2024.09',
  },
})

// apiFetch internally does:
body: body ? JSON.stringify(body) : undefined  // Stringifies once
```

Result: `{"gameType":"coinche",...}` (proper JSON)

## Files Fixed

### Frontend

1. **`src/features/lobby/LobbyPage.tsx`**
   - Removed `JSON.stringify()` from createRoomMutation
   - Pass object directly to `apiFetch`

2. **`src/features/room/RoomPage.tsx`**
   - Removed `JSON.stringify()` from toggleReadyMutation
   - Pass object directly to `apiFetch`

3. **`src/features/game/BiddingPanel.tsx`**
   - Removed `JSON.stringify()` from bidMutation
   - Pass object directly to `apiFetch`

4. **`src/features/game/CardPlayPanel.tsx`**
   - Removed `JSON.stringify()` from playCardMutation
   - Pass object directly to `apiFetch`

### Backend

5. **`server/tests/create-room.spec.ts`** (NEW)
   - Added test to document the bug and verify the fix
   - 2 tests covering correct API usage

## Test Results

```bash
npm test

Test Files  8 passed (8)
Tests  69 passed (69) ✓
```

All tests pass, including 2 new tests that verify the fix.

## How to Verify

### Before Fix

```bash
# Start frontend
npm run dev

# Click "Create Room" in lobby
# Result: Error 400 - Invalid JSON
```

### After Fix

```bash
# Start frontend
npm run dev

# Click "Create Room" in lobby
# Result: ✅ Room created, redirected to room page
```

## Lesson Learned

**Rule:** When using `apiFetch()`, always pass objects directly as `body`. Never pre-stringify.

```typescript
// ✅ Correct
apiFetch('/endpoint', {
  method: 'POST',
  body: { key: 'value' }
})

// ❌ Wrong
apiFetch('/endpoint', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' })
})
```

The `apiFetch` function handles JSON stringification internally, so manual stringification causes double-encoding.

## Summary

- ✅ Bug identified and reproduced
- ✅ Root cause found (double JSON.stringify)
- ✅ Fixed in 4 frontend files
- ✅ Added regression tests
- ✅ All 69 tests passing
- ✅ Create Room button now works correctly
