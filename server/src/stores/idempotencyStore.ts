const store = new Map<string, { status: number; body: unknown; expiresAt: number }>();

const makeKey = (scope: string, key: string, userId: string | undefined) => `${scope}:${userId ?? 'anon'}:${key}`;

const TTL_MS = 10 * 60 * 1000;

export const idempotencyStore = {
  get(scope: string, key: string, userId?: string) {
    const compositeKey = makeKey(scope, key, userId);
    const entry = store.get(compositeKey);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      store.delete(compositeKey);
      return null;
    }
    return { status: entry.status, body: entry.body };
  },

  set(scope: string, key: string, userId: string | undefined, status: number, body: unknown) {
    const compositeKey = makeKey(scope, key, userId);
    store.set(compositeKey, {
      status,
      body,
      expiresAt: Date.now() + TTL_MS,
    });
  },

  clearExpired() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt < now) {
        store.delete(key);
      }
    }
  },

  reset() {
    store.clear();
  },
};
