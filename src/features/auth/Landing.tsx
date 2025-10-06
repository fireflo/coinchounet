import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const providerButtonClass =
  'flex-1 rounded-md border border-border px-4 py-3 text-sm font-medium transition hover:bg-secondary';

const DEV_USERNAME = 'admin';
const DEV_PASSWORD = 'password';

const Landing = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const handleBypassLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username === DEV_USERNAME && password === DEV_PASSWORD) {
      setAuthError(null);
      navigate('/lobby');
      return;
    }
    setAuthError('Invalid development credentials. Use admin/password.');
  };

  return (
    <section className="mx-auto max-w-3xl text-center">
      <div className="rounded-2xl bg-card p-10 shadow-sm">
        <h1 className="text-3xl font-semibold">Play Coinche, Anywhere</h1>
        <p className="mt-3 text-muted-foreground">
          Join friends, create private rooms, and enjoy competitive turn-based play with real-time updates powered by
          Socket.IO.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button type="button" className={providerButtonClass}>
            Continue with Google
          </button>
          <button type="button" className={providerButtonClass}>
            Continue with Facebook
          </button>
        </div>
        <div className="mt-6 text-sm text-muted-foreground">
          or
          <Link to="/lobby" className="ml-1 font-medium text-primary hover:underline">
            browse public lobbies
          </Link>
        </div>

        <form onSubmit={handleBypassLogin} className="mt-8 text-left">
          <div className="rounded-md border border-dashed border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Development bypass (temporary)
            </p>
            <label className="mt-3 block text-sm font-medium text-muted-foreground" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              autoComplete="username"
            />
            <label className="mt-4 block text-sm font-medium text-muted-foreground" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password"
              autoComplete="current-password"
            />
            {authError && <p className="mt-3 text-sm text-destructive">{authError}</p>}
            <button
              type="submit"
              className="mt-4 inline-flex w-full justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Enter lobby (dev)
            </button>
          </div>
        </form>

        <div className="mt-8 rounded-md border border-dashed border-border p-4 text-left text-xs text-muted-foreground">
          <p className="font-semibold uppercase tracking-wide">Upcoming</p>
          <ul className="mt-2 space-y-1">
            <li>OAuth 2.1 PKCE sign-in with Google / Facebook (see `specs/client-server.md`).</li>
            <li>Remembered locale and theming preferences per room metadata.</li>
            <li>Offline spectator mode for completed games.</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Landing;
