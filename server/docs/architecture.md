# Server Architecture Overview

This service implements the REST API described in `../specs/openapi.yaml` for the turn-based card game platform. The frontend consumes the same contract via `src/api/client.ts`.

## Layers
- **Routing (`src/routes/`)**
  - Express routers group endpoints by domain: `health`, `auth`, `rooms`, `games`, `turns`, `moves`, `admin`, `streaming`.
  - Routes apply shared middleware (auth, validation, idempotency) and delegate to controllers.
- **Controllers (`src/controllers/`)**
  - Translate HTTP requests into service calls.
  - Marshal service results into response DTOs mirroring OpenAPI schemas.
- **Services (`src/services/`)**
  - Encapsulate business logic for rooms, games, turns, moves, auth token exchange, and event distribution.
  - Coordinate with stores and ruleset modules.
- **Stores (`src/stores/`)**
  - Provide persistence abstractions. Initial implementation uses in-memory maps keyed by IDs.
  - Interfaces designed to support future database integrations.
- **Rules (`src/rules/`)**
  - Host game-specific validators (e.g., coinche). Initial module mocks enforce simplified legal-move checks.
- **Events (`src/events/`)**
  - Publish/subscribe hub for broadcasting move acceptance, state changes, and heartbeat events.

## Middleware
- **Auth (`src/middleware/auth.ts`)**
  - Parses `Authorization: Bearer` tokens.
  - Injects `req.user` with role metadata.
  - Supports dev token bypass for local testing.
- **Validation (`src/middleware/validateRequest.ts`)**
  - Uses Zod schemas aligned with OpenAPI definitions.
  - Normalizes validation errors to `ErrorResponse` with `invalid_payload` code.
- **Idempotency (`src/middleware/idempotency.ts`)**
  - Tracks recent `Idempotency-Key` values per user for POST endpoints.
  - Returns cached results on retries.

## Request Flow
1. Express route matches path from `openapi.yaml`.
2. Middleware stack enforces auth, idempotency, and payload validation.
3. Controller calls service with typed inputs.
4. Service interacts with stores and rules modules, emitting events.
5. Controller transforms domain result into API schema and sends JSON response.

## Error Handling
- Domain and validation errors throw `HttpError` objects consumed by `src/app.ts` error handler.
- Responses follow `ErrorResponse` schema with `code`, `message`, optional `details`, and `correlationId`.

## Realtime Integration
- **Socket.IO Server** (`src/realtime/socketServer.ts`) provides WebSocket-based real-time communication
  - Channels: `room:{roomId}` for room updates, `game:{gameId}:public` for game state, `game:{gameId}:private:{playerId}` for private player data
  - Events: `room:updated`, `game:state_changed`, `game:move_accepted`, `game:turn_changed`, `system:heartbeat`
  - Authentication via token in handshake, supports dev tokens `dev-user-{userId}`
- **REST Fallback** (`GET /games/{gameId}/events`) for event replay when WebSocket disconnected

## Implementation Status
- **Completed**
  - In-memory stores for rooms, games, events, and idempotency (`src/stores/`).
  - Business logic for room lifecycle and coinche gameplay (`src/services/roomService.ts`, `src/services/gameService.ts`).
  - **Full coinche rule validation** (`src/rules/coinche.ts`) implementing complete rule set from specs:
    - Card ranking (trump vs non-trump)
    - Following suit requirements
    - Trumping and overtrumping rules
    - Partner winning exception
    - Trick winner determination
  - Controllers for rooms, games, and auth (`src/controllers/`).
  - Shared middleware (`auth`, `validateRequest`, `idempotency`) and utility helpers (`asyncHandler`).
  - Zod schemas for rooms, moves, and OAuth token exchange under `src/schemas/`.
  - Route modules (`src/routes/`) exposing all REST endpoints: auth, rooms, games, and streaming placeholders.
  - Auth token exchange service/controller (`/auth/oauth/token`) with mock implementation for dev/MVP.
  - **Socket.IO real-time server** (`src/realtime/socketServer.ts`) with room/game channels and event broadcasting.
  - Event streaming REST endpoint (`/games/{gameId}/events`) using `eventStore`.
  - Server entrypoint (`src/server.ts`) with Socket.IO integration and graceful shutdown handling.
  - Vitest + Supertest test suites covering health, rooms, games, moves, and events (17 tests passing).
- **Pending**
  - Production OAuth provider integration (currently using mock tokens for dev).
  - Bidding phase implementation for coinche (currently simplified to skip bidding).
  - Belote/Rebelote announcement tracking.
  - Scoring calculation (capot, dix de der, contract fulfillment).
  - Database integration (currently using in-memory stores).

## Testing Strategy
- Vitest + Supertest integration tests in `tests/` cover the critical flows:
  - `GET /health`
  - Room lifecycle (`POST /rooms`, `POST /rooms/:id/join`, `POST /rooms/:id/start`)
  - Game state (`GET /games/:gameId`, `GET /games/:gameId/turns/current`)
  - Move submission (`POST /games/:gameId/turns/current/move`)
- Unit tests target services and rules to ensure deterministic behaviour.

## Configuration
- Environment variables managed via `.env` or `mise` tasks. Key vars: `PORT`, `DEV_TOKEN`, `LOG_LEVEL`.
- `pnpm` scripts run under Node 20 as defined in `server/mise.toml`.

## Shared Specs
- `server/openapi.yaml` is synced from root `specs/openapi.yaml`. Update workflow:
  1. Modify the canonical spec in `../specs/openapi.yaml`.
  2. Run `pnpm --filter server sync:spec` (planned) or manually copy the file.
