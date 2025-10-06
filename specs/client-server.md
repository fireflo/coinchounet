# Turn-Based Card Game Client-Server API Specification

## 1. Purpose & Scope
- **Goal**: Provide a consistent REST + event-streaming interface for turn-based card games (e.g., `coinche`, `belote`, `bridge`).
- **Supported Scenarios**: Lobby creation, player seating, game start, turn execution, move validation, game state synchronization, session recovery.
- **Out of Scope**: Real-time chat messaging or voice features (handled by external services if needed).

## 2. Transport, Formats & Versioning
- **Base URL**: `https://api.example.com/v1` (versioned path; breaking changes trigger new major version).
- **Protocols**:
  - HTTP/1.1 or HTTP/2 for REST endpoints with JSON payloads (`Content-Type: application/json`).
  - WebSocket or Server-Sent Events (SSE) for push notifications from `wss://api.example.com/v1/events`.
- **Time**: All timestamps in ISO-8601 UTC with milliseconds, e.g., `2025-10-05T21:18:39.000Z`.
- **Idempotency**: Clients include `Idempotency-Key` header on mutating POST requests to guarantee safe retries.

## 3. Authentication & Authorization
- **OAuth 2.1 Authorization Code with PKCE**.
- **Whitelisted Identity Providers**: Only Google and Facebook OAuth providers are accepted at launch. Future providers must be explicitly added to the server-side whitelist (`google`, `facebook`).
- **Token Exchange**:
  1. Client performs provider login and obtains authorization code.
  2. Client posts to `POST /auth/oauth/token` with provider (`google` or `facebook`), authorization code, and PKCE verifier.
  3. Server validates against the provider, checks whitelist, and issues platform access + refresh tokens (`Bearer` access token, 15 min TTL; refresh token, 30 days TTL).
- **Roles**: `player`, `host`, `spectator`, `admin`. Role derived from room/game context. Hosts can promote/demote players inside their room.
- **Authorization**: Access tokens required for all endpoints except `GET /health`.

## 4. Core Resources
| Resource | Description |
| --- | --- |
| `Room` | Lobby where players gather before a game starts. |
| `Seat` | Slot within a room tied to a player. |
| `Game` | Turn-based game instance derived from a room. |
| `Turn` | Atomic unit of play determining who may submit moves. |
| `Move` | Validated action submitted by the active player during their turn. |
| `Event` | Server-originated notification describing state changes. |

## 5. Room Lifecycle API
### 5.1 Create Room
- **Endpoint**: `POST /rooms`
- **Auth**: `Bearer` token (`host` role required).
- **Body**:
```json
{
  "gameType": "coinche",
  "maxSeats": 4,
  "visibility": "private",
  "rulesetVersion": "2024.09",
  "metadata": {
    "language": "fr-FR"
  }
}
```
- **Responses**:
  - `201 Created` with `Room` object including `roomId`, `seats`, `hostId`, `status: lobby`, `createdAt`.
  - `400` for invalid ruleset or unsupported `gameType`.

### 5.2 List Rooms
- `GET /rooms?gameType=coinche&status=lobby`
- Filters: `gameType`, `visibility`, `status`, `page`, `pageSize`.
- `200` returns paginated collection. No authentication required for public rooms; token required for private host view.

### 5.3 Join Room
- **Endpoint**: `POST /rooms/{roomId}/join`
- **Auth**: `player` role.
- **Body** (optional seat preference):
```json
{
  "seatIndex": 2,
  "asSpectator": false
}
```
- **Responses**:
  - `200` with updated `Room` snapshot (seat assignments, ready states, ruleset).
  - `403` if room locked or player banned.
  - `409` if preferred seat occupied.

### 5.4 Leave Room / Kick Player
- Player-initiated: `POST /rooms/{roomId}/leave` (self).
- Host-initiated: `POST /rooms/{roomId}/seats/{playerId}/remove`.
- Responses: `200` with updated room; `404` if seat not found.

### 5.5 Ready & Room State
- Players toggle readiness: `POST /rooms/{roomId}/ready` with body `{ "ready": true }`.
- Host locks room before start: `POST /rooms/{roomId}/lock` / `unlock` (optional feature).

## 6. Game Lifecycle API
### 6.1 Start Game
- **Endpoint**: `POST /rooms/{roomId}/start`
- Preconditions: All seats filled, all players ready, room unlocked.
- Responses:
  - `201 Created` with `Game` resource containing `gameId`, `turnOrder`, `initialState`, `turnId`.
  - `422` if preconditions unmet.

### 6.2 Game Snapshot
- `GET /games/{gameId}` returns current scoreboard, trick history, contract info (for coinche), active turn.
- `GET /games/{gameId}/state?sinceVersion=42` returns incremental diff (`version` increments on every accepted move).

### 6.3 Turn Metadata
- `GET /games/{gameId}/turns/current`
- Returns `turnId`, `activePlayerId`, `legalMoveTypes`, `deadline` (if timeboxing), `turnSequence` array.

### 6.4 Dealing & Hidden Information
- **Shuffle & Deal**
  - The server performs the shuffle using a CSPRNG. For auditability, it publishes a commitment (see Appendix D) before dealing and reveals the seed after the hand is completed.
  - Dealing pattern (e.g., `3-2-3` for 8-card games) is defined by the ruleset and recorded in the game state.
- **Private Hand Delivery**
  - Endpoint: `GET /games/{gameId}/me/hand`
    - Returns only the authenticated player’s current hand.
    - `200` body:
      ```json
      { "cards": ["J♠", "9♠", "A♦", "10♥", "K♥", "Q♣", "8♣", "7♦"], "handVersion": 1 }
      ```
  - Event (private stream only): `player.hand.dealt` with `{ cards: [...], handVersion }`.
- **Public Redaction Rules**
  - Public endpoints (`GET /games/{gameId}`, state diffs, public streams) never include other players’ concealed cards.
  - Public state exposes only counts, e.g., `{ "handCounts": { "user_111": 8, "user_222": 8, ... } }` and cards that are face-up (on table, in tricks, or revealed by rule).
  - Spectators receive the same redacted public view.
- **Hand Versioning**
  - `handVersion` increments on any change (draw, play, reveal). Clients use it to reconcile with server events and handle retries.

### 6.5 Card Containers Model
- **Canonical Containers** (names used across games; some may be unused per ruleset):
  - `hands`: map of `playerId -> Hand` (private to owner).
  - `drawPile`: face-down deck used to draw (a.k.a. stock). Hidden; only size is public.
  - `discardPile`: face-up waste pile; typically public, top card visible.
  - `tableCenter`: shared face-up area for currently played cards not yet part of a resolved trick or for layout games.
  - `currentTrick`: cards played in the ongoing trick; public and ordered by play sequence.
  - `trickHistory`: list of completed tricks with winner metadata; public.
  - Optional containers per ruleset: `revealedArea` (face-up revealed cards), `kitty`/`talon` (face-down reserve), `burnPile` (face-down removed cards).
- **Visibility & Redaction**
  - `hands`: Only the owner can see the actual cards via `GET /games/{gameId}/me/hand` or private stream. Others see only hand counts in public state.
  - `drawPile`/`kitty`/`burnPile`: Only `count` exposed publicly. No card identities leaked.
  - `discardPile`, `tableCenter`, `currentTrick`, `trickHistory`, `revealedArea`: Public and include card identities and play order.
- **Ordering Semantics**
  - Containers define ordering: `top` for piles, `playOrder` for tricks, `appendOnly` for histories.
  - Moves maintain ordering constraints (e.g., playing onto `currentTrick` appends at end).
- **Container Transitions**
  - Typical flows: `drawPile -> hand`, `hand -> currentTrick`, `currentTrick -> trickHistory`, `hand -> discardPile`, `tableCenter <-> hand` where rules permit.
  - The server enforces legal transitions via the ruleset validator.

## 7. Move Submission & Validation Flow
### 7.1 Submit Move
- **Endpoint**: `POST /games/{gameId}/turns/current/move`
- **Body**:
```json
{
  "clientMoveId": "2d3fa6b0-71eb-11e9-b475-0800200c9a66",
  "moveType": "play_card",
  "payload": {
    "card": "J♠"
  },
  "stateVersion": 42
}
```
- **Validation Steps**:
  1. **Turn Ownership**: Server confirms caller is `activePlayerId` for `turnId`.
  2. **Turn Staleness**: `stateVersion` must match current authoritative version; mismatch returns `409 Conflict` with latest snapshot.
  3. **Ruleset**: Server runs move against game-specific validator (e.g., legal card following for coinche).
  4. **Concurrency**: Idempotency key ensures duplicates return same result.
- **Responses**:
  - `202 Accepted` when validation requires asynchronous resolution (e.g., waiting on partner confirmations). Event will finalize result.
  - `200 OK` with `MoveResult` if validation completes synchronously.
  - `400` for malformed payload; `403` for unauthorized move (not player turn); `409` for version mismatch; `422` for illegal move (rules violation with explanation).

### 7.2 Move Resolution Events
- Event types delivered via WebSocket/SSE:
  - `turn.move.accepted`: Includes `moveId`, `turnId`, resulting `stateVersion`.
  - `turn.move.rejected`: Includes `reason`, `violations`, recommended recovery actions.
  - `turn.changed`: Announces next `turnId`, `activePlayerId`, deadlines.

### 7.3 Undo / Adjudication (Optional)
- Administrative override: `POST /games/{gameId}/moves/{moveId}/invalidate` limited to `admin` role for tournament adjudication.

## 8. State Synchronization & Recovery
- **Push**: Clients subscribe to `wss://api.example.com/v1/games/{gameId}/stream`.
  - Message envelope:
```json
{
  "eventId": "evt_01HX9...",
  "eventType": "turn.move.accepted",
  "occurredAt": "2025-10-05T21:18:39.000Z",
  "payload": { ... }
}
```
- **Private Push**: Players may additionally subscribe to `wss://api.example.com/v1/games/{gameId}/players/me/stream` to receive private events (e.g., `player.hand.dealt`, `player.hand.updated`).
- **Redaction Enforcement**: Public streams and snapshots contain no hidden cards. Only the owner’s hand is sent over the private stream or `GET /games/{gameId}/me/hand`.
- **Heartbeat**: Server sends `system.heartbeat` every 15s; clients reconnect after 30s of inactivity.
- **Replay**: Clients may request missed events via `GET /games/{gameId}/events?after=evt_01HX9` when resuming.
- **Snapshot + Diff Workflow**:
  1. Client loads `GET /games/{gameId}/state`.
  2. Client subscribes and applies incoming diffs.
  3. If diff application fails, client falls back to fresh snapshot.

## 9. Error Handling Conventions
| HTTP Code | Scenario | Error Code | Message |
| --- | --- | --- | --- |
| 400 | Invalid payload | `invalid_payload` | Describe missing/invalid fields. |
| 401 | Missing/expired token | `unauthorized` | Prompt re-authentication. |
| 403 | Role/permission mismatch | `forbidden` | Include required role. |
| 404 | Resource not found | `not_found` | Reference resource type. |
| 409 | Version conflict | `version_conflict` | Provide latest `stateVersion`. |
| 422 | Move violates rules | `illegal_move` | Include rule references. |
| 429 | Rate limited | `rate_limited` | Advise retry-after. |
| 500+ | Server fault | `server_error` | Correlation ID for support. |

- Errors return structure:
```json
{
  "error": {
    "code": "illegal_move",
    "message": "Card J♠ cannot be played; suit must follow.",
    "details": {
      "requiredSuit": "♥"
    },
    "correlationId": "corr_01J8..."
  }
}
```

## 10. Security & Compliance
- Enforce HTTPS everywhere.
- Refresh tokens stored with sliding expiration and rotated on use.
- Rate limiting: 100 write ops / minute / user; 600 read ops / minute / user.
- Audit trail: All move submissions logged with outcome, latency, validator result, and player identity.
- PII storage complies with GDPR; minimal player profile (display name, avatar URL, locale).

## 11. Monitoring & Health
- `GET /health` returns service status (database, message broker checks).
- Metrics exposed via `GET /metrics` (Prometheus format) requiring `admin` role.
- Alerts on move validation latency > 500 ms p95, room creation errors > 1/min.

## 12. Appendix A: Resource Schemas (Simplified)
### 12.1 Room
```json
{
  "roomId": "room_123",
  "gameType": "coinche",
  "status": "lobby",
  "hostId": "user_987",
  "maxSeats": 4,
  "seats": [
    { "index": 0, "playerId": "user_111", "ready": true },
    { "index": 1, "playerId": "user_222", "ready": true },
    { "index": 2, "playerId": "user_333", "ready": false },
    { "index": 3, "playerId": null, "ready": false }
  ],
  "metadata": { "language": "fr-FR" },
  "createdAt": "2025-10-05T21:18:39.000Z"
}
```

### 12.2 Game State
```json
{
  "gameId": "game_456",
  "roomId": "room_123",
  "status": "in_progress",
  "turnId": "turn_42",
  "turnOrder": ["user_111", "user_222", "user_333", "user_444"],
  "stateVersion": 42,
  "score": {
    "teamA": 72,
    "teamB": 54
  },
  "contracts": [
    {
      "team": "teamA",
      "type": "spades",
      "value": 90,
      "coinched": true,
      "surcoinched": false
    }
  ],
  "tricks": [ ... ],
  "lastUpdated": "2025-10-05T21:19:00.000Z"
}
```

### 12.3 MoveResult
```json
{
  "moveId": "move_789",
  "clientMoveId": "2d3fa6b0-71eb-11e9-b475-0800200c9a66",
  "validationStatus": "accepted",
  "turnId": "turn_42",
  "stateVersion": 43,
  "effects": {
    "cardPlayed": "J♠",
    "nextPlayerId": "user_222"
  },
  "occurredAt": "2025-10-05T21:19:03.000Z"
}
```

### 12.4 Event
```json
{
  "eventId": "evt_01HX9",
  "eventType": "turn.move.accepted",
  "occurredAt": "2025-10-05T21:18:39.000Z",
  "source": "game",
  "gameId": "game_456",
  "payload": {
    "moveId": "move_789",
    "stateVersion": 43
  }
}
```

### 12.5 PrivateHand (Owner-only)
```json
{
  "playerId": "user_111",
  "gameId": "game_456",
  "cards": ["J♠", "9♠", "A♦", "10♥", "K♥", "Q♣", "8♣", "7♦"],
  "handVersion": 1,
  "lastUpdated": "2025-10-05T21:19:00.000Z"
}
```

### 12.6 PublicHandSummary (Redacted)
```json
{
  "gameId": "game_456",
  "handCounts": {
    "user_111": 8,
    "user_222": 8,
    "user_333": 8,
    "user_444": 8
  }
}
```

## 13. Appendix B: Ruleset Integration
- Each `gameType` references a ruleset service implementing:
  - `validateMove(gameState, move) -> { valid: bool, violations: [] }`
  - `applyMove(gameState, move) -> newState`
  - `computeScore(gameState) -> Scorecard`
- Ruleset version specified during room creation determines validator behavior for entire game lifecycle.

## 14. Appendix C: Turn Timeout & Auto-Play
- Optional per-room configuration `turnTimeoutSeconds`.
- When timeout triggers: server issues `turn.move.timeout` event, auto-plays fallback move (if allowed) via ruleset or ends game due to forfeit.
- Auto-play moves tagged with `systemGenerated: true` in `MoveResult`.
