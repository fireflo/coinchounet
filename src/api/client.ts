const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.example.com/v1';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions<TBody> {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function apiFetch<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  const { method = 'GET', body, headers, signal } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = errorPayload?.error?.message ?? response.statusText;
    throw new Error(`API error (${response.status}): ${message}`);
  }

  if (response.status === 204) {
    return undefined as unknown as TResponse;
  }

  return (await response.json()) as TResponse;
}

export const queryKeys = {
  rooms: () => ['rooms'] as const,
  room: (roomId: string) => ['room', roomId] as const,
  game: (gameId: string) => ['game', gameId] as const,
  turn: (gameId: string) => ['turn', gameId] as const,
  privateHand: (gameId: string, playerId: string) => ['hand', gameId, playerId] as const,
};
