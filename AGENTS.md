# Agent Guidelines

Start by looking at `docs/architecture.md` and `specs/ui-archtecture.md` and `specs/client-server.md`. Update them as necessary.

## Frontend implementation guidelines

- Always adopt the latest stable React + TypeScript stack, matching `specs/ui-architecture.md` (Vite, TanStack Query, Zustand, Tailwind/Radix, Socket.IO client).
- Do not add polyfills or conditional logic for legacy browsers (IE, old Safari). Target evergreen browsers only.
- Prefer functional components with hooks, server-state managed via TanStack Query, and colocated feature folders as described in the spec.
- Ensure Socket.IO client integration follows the shared `src/realtime/socket.ts` wrapper for joins, acknowledgements, and reconnection handling.
