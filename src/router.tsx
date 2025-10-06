import React, { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';

const Landing = lazy(() => import('./features/auth/Landing'));
const LobbyPage = lazy(() => import('./features/lobby/LobbyPage'));
const RoomPage = lazy(() => import('./features/room/RoomPage'));
const GameTablePage = lazy(() => import('./features/game/GameTablePage'));

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Loading…</div>}>
    {element}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <div className="p-6">Something went wrong. Try reloading.</div>,
    children: [
      { index: true, element: withSuspense(<Landing />) },
      { path: 'lobby', element: withSuspense(<LobbyPage />) },
      { path: 'rooms/:roomId', element: withSuspense(<RoomPage />) },
      { path: 'games/:gameId', element: withSuspense(<GameTablePage />) },
    ],
  },
]);
