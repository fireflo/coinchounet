import { NavLink, Outlet } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
  }`;

export const AppLayout = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <NavLink to="/" className="text-lg font-semibold">
          Coinchounet
        </NavLink>
        <nav className="flex items-center gap-2">
          <NavLink to="/lobby" className={navLinkClass}>
            Lobby
          </NavLink>
          <NavLink to="/rooms/demo-room" className={navLinkClass}>
            Room Demo
          </NavLink>
          <NavLink to="/games/demo-game" className={navLinkClass}>
            Table Demo
          </NavLink>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Outlet />
    </main>
  </div>
);

export default AppLayout;
