const API = import.meta.env.VITE_API_BASE as string;

export async function api<T>(
  path: string,
  opts: RequestInit = {},
  token?: string
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let message = `${res.status} ${res.statusText}`;
    if (contentType && contentType.includes("application/json")) {
      try {
        const body = await res.json();
        if ((body as any)?.message) {
          message += ` - ${(body as any).message}`;
        } else {
          message += ` - ${JSON.stringify(body)}`;
        }
      } catch {
        message += " - Unexpected error response";
      }
    } else {
      const text = await res.text();
      if (text) message += ` - ${text}`;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function login(email: string, password: string) {
  return api<{ token: string; role: string; displayName: string }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

export async function register(email: string, displayName: string, password: string) {
  return api<{ userId: number; token: string; role: string; displayName: string }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify({ email, displayName, password }) }
  );
}

// Players
export const getPlayers = (token: string) =>
  api<any[]>("/api/players", {}, token);

export const createPlayer = (displayName: string, isRegistered: boolean, token: string, userId?: number) =>
  api<any>("/api/players", {
    method: "POST",
    body: JSON.stringify({ displayName, isRegistered, userId })
  }, token);

export const deletePlayer = (playerId: number, token: string) =>
  api<any>(`/api/players/${playerId}`, { method: "DELETE" }, token);

// Queues
export const createQueue = (name: string, mode: string, token: string, sessionId?: number) =>
  api<any>("/api/queues", {
    method: "POST",
    body: JSON.stringify({ name, mode, sessionId })
  }, token);

export const getQueueDetails = (queueId: number, token: string) =>
  api<any>(`/api/queues/${queueId}`, {}, token);

export const setQueueStatusQueue = (queueId: number, isOpen: boolean, token: string) =>
  api<any>(`/api/queues/${queueId}/status`, {
    method: "POST",
    body: JSON.stringify(isOpen)
  }, token);

export const enqueueQueue = (queueId: number, playerId: number, token: string) =>
  api<any>(`/api/queues/${queueId}/enqueue`, {
    method: "POST",
    body: JSON.stringify({ playerId })
  }, token);

export const removeFromQueue = (queueId: number, playerId: number, token: string) =>
  api<any>(`/api/queues/${queueId}/remove`, {
    method: "POST",
    body: JSON.stringify({ playerId })
  }, token);

export const startQueueMatch = (queueId: number, mode: string | undefined, token: string) =>
  api<any>(`/api/queues/${queueId}/start-match`, { method: "POST", body: JSON.stringify({ mode }) }, token);

export const startQueueMatchManual = (queueId: number, playerIds: number[], mode: string | undefined, token: string) =>
  api<any>(`/api/queues/${queueId}/start-match-manual`, {
    method: "POST",
    body: JSON.stringify({ playerIds, mode })
  }, token);

export const finishQueueMatch = (
  queueId: number,
  matchId: number,
  winnerId: number,
  sets: { a: number; b: number }[],
  token: string
) =>
  api<any>(`/api/queues/${queueId}/finish-match`, {
    method: "POST",
    body: JSON.stringify({ matchId, winnerId, sets })
  }, token);

export const getOngoingMatches = (queueId: number, token: string) =>
  api<any[]>(`/api/queues/${queueId}/ongoing-matches`, {}, token);

export const getMatchHistory = (queueId: number, token: string, status = "Finished") =>
  api<any[]>(`/api/queues/${queueId}/matches?status=${encodeURIComponent(status)}`, {}, token);

// Sessions
export const listSessions = (token: string, search?: string) =>
  api<any[]>(`/api/sessions${search ? `?search=${encodeURIComponent(search)}` : ""}`, {}, token);

export const getSessionDetail = (sessionId: number, token: string) =>
  api<any>(`/api/sessions/${sessionId}`, {}, token);

export const createSession = (name: string, description: string | undefined, isPublic: boolean, token: string) =>
  api<any>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ name, description, isPublic })
  }, token);

export const joinSession = (sessionId: number, token: string) =>
  api<any>(`/api/sessions/${sessionId}/join`, { method: "POST" }, token);

export const leaveSession = (sessionId: number, token: string) =>
  api<any>(`/api/sessions/${sessionId}/leave`, { method: "POST" }, token);

export const checkInSession = (sessionId: number, userId: number, token: string) =>
  api<any>(`/api/sessions/${sessionId}/check-in`, {
    method: "POST",
    body: JSON.stringify({ userId })
  }, token);

export const checkOutSession = (sessionId: number, userId: number, token: string) =>
  api<any>(`/api/sessions/${sessionId}/check-out`, {
    method: "POST",
    body: JSON.stringify({ userId })
  }, token);

export const deleteSession = (sessionId: number, token: string) =>
  api<any>(`/api/sessions/${sessionId}`, { method: "DELETE" }, token);

// Legacy stubs for removed endpoints (Courts/QM pages). Safe no-ops to satisfy build.
export const getLocations = (_token: string) => Promise.resolve([] as any[]);
export const getCourts = (_locationId: number, _token: string) => Promise.resolve([] as any[]);
export const getQueue = (_courtId: number, _mode: string, _token: string) => Promise.resolve({ entries: [], isOpen: true, mode: "Singles" });
export const setQueueStatus = (_courtId: number, _mode: string, _isOpen: boolean, _token: string) => Promise.resolve<void>(undefined);
export const enqueueSelf = (_courtId: number, _mode: string, _token: string) => Promise.resolve<void>(undefined);
export const leaveSelf = (_courtId: number, _mode: string, _token: string) => Promise.resolve<void>(undefined);
export const startMatch = (_courtId: number, _mode: string, _token: string) => Promise.resolve({ matchId: 0, players: "" });
export const finishMatch = (_matchId: number, _scoreText: string, _token: string) => Promise.resolve<void>(undefined);
