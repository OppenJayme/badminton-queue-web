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

export const getLocations = (token: string) =>
  api<any[]>("/api/locations", {}, token);

export const getCourts = (locationId: number, token: string) =>
  api<any[]>(`/api/locations/${locationId}/courts`, {}, token);

export const getQueue = (courtId: number, mode: string, token: string) =>
  api<any>(`/api/queues/${courtId}?mode=${mode}`, {}, token);

export const setQueueStatus = (courtId: number, mode: string, isOpen: boolean, token: string) =>
  api<any>(`/api/queues/${courtId}/status`, {
    method: "POST",
    body: JSON.stringify({ mode, isOpen })
  }, token);

export const enqueueSelf = (courtId: number, mode: string, token: string) =>
  api<any>(`/api/queues/${courtId}/enqueue?mode=${mode}`, {
    method: "POST",
    body: JSON.stringify({})
  }, token);

export const leaveSelf = (courtId: number, mode: string, token: string) =>
  api<any>(`/api/queues/${courtId}/leave?mode=${mode}`, {
    method: "POST",
    body: JSON.stringify({})
  }, token);

export const startMatch = (courtId: number, mode: string, token: string) =>
  api<any>(`/api/matches/start`, {
    method: "POST",
    body: JSON.stringify({ courtId, mode })
  }, token);

export const finishMatch = (matchId: number, scoreText: string, token: string) =>
  api<any>(`/api/matches/finish`, {
    method: "POST",
    body: JSON.stringify({ matchId, scoreText })
  }, token);
