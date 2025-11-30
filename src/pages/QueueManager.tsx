import { useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useParams } from "react-router-dom";
import {
  createPlayer,
  createQueue,
  enqueueQueue,
  finishQueueMatch,
  getMatchHistory,
  getOngoingMatches,
  getPlayers,
  getQueueDetails,
  getSessionDetail,
  removeFromQueue,
  setQueueStatusQueue,
  setQueueModeQueue,
  startQueueMatch,
  startQueueMatchManual,
  deletePlayer
} from "../api/client";
import { tokenAtom, nameAtom } from "../state/auth";
import { cacheUserAtom, lastQueueBySessionAtom, lastQueueIdAtom, queueCacheAtom, sessionCacheAtom } from "../state/cache";
import type { MatchHistory, OngoingMatch, Player, QueueDetails, QueueEntry } from "../types/queue";
import type { SessionDetail } from "../types/session";
import "bootstrap/dist/css/bootstrap.min.css";

type ActionErrors = Record<string, string | null>;
type ActionLoading = Record<string, boolean>;

function decodeUserId(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload));
    const sub =
      json.sub ??
      json.nameid ??
      json["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    const parsed = Number(sub);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function QueueManager() {
  const token = useAtomValue(tokenAtom)!;
  const currentUserId = decodeUserId(token);
  const displayName = useAtomValue(nameAtom) || "You";
  const { sessionId: sessionParam } = useParams();
  const sessionIdFromRoute = sessionParam ? Number(sessionParam) : undefined;

  const [sessionCache, setSessionCache] = useAtom(sessionCacheAtom);
  const [queueCache, setQueueCache] = useAtom(queueCacheAtom);
  const [lastQueueBySession, setLastQueueBySession] = useAtom(lastQueueBySessionAtom);
  const [lastQueueId, setLastQueueId] = useAtom(lastQueueIdAtom);
  const [cacheUser, setCacheUser] = useAtom(cacheUserAtom);

  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [queue, setQueue] = useState<QueueDetails | null>(null);
  const [mode, setMode] = useState<"Singles" | "Doubles">("Singles");
  const [queueName, setQueueName] = useState("Main Queue");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [tab, setTab] = useState<"auto" | "manual" | "ongoing" | "history">("auto");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [ongoing, setOngoing] = useState<OngoingMatch[]>([]);
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [finishModal, setFinishModal] = useState<{ matchId: number | null; players: { id: number; name: string }[] }>({ matchId: null, players: [] });
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [finishMode, setFinishMode] = useState<"bo3" | "single">("bo3");
  const [setScores, setSetScores] = useState<{ a: string; b: string }[]>([
    { a: "", b: "" },
    { a: "", b: "" },
    { a: "", b: "" }
  ]);
  const finishedQueueIdRef = useRef<number | null>(null);
  const syncingCheckinsRef = useRef(false);
  const createdUserIdsRef = useRef<Set<number>>(new Set());
  const userModeChangedRef = useRef(false);
  const suppressSyncRef = useRef(false);
  const finishingQueueRef = useRef(false);
  const [finishingQueue, setFinishingQueue] = useState(false);

  function resetQueueState(queueId?: number | null, sessionId?: number | null) {
    if (queueId) finishedQueueIdRef.current = queueId;
    userModeChangedRef.current = false;
    setQueue(null);
    setOngoing([]);
    setHistory([]);
    setSelectedIds([]);
    setQueueCache((prev) => {
      if (!queueId) return prev;
      const next = { ...prev };
      delete next[queueId];
      return next;
    });
    setLastQueueBySession((prev) => {
      const next = { ...prev };
      if (sessionId) delete next[sessionId];
      return next;
    });
    setLastQueueId(null);
    setMode("Singles");
    setQueueName("Main Queue");
  }
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<ActionErrors>({});
  const [loading, setLoading] = useState<ActionLoading>({});
  const [info, setInfo] = useState<string | null>(null);
  // Clear caches if a different user logs in.
  useEffect(() => {
    if (currentUserId == null) return;
    if (cacheUser !== currentUserId) {
      setSessionCache({});
      setQueueCache({});
      setLastQueueBySession({});
      setLastQueueId(null);
      setCacheUser(currentUserId);
      setQueue(null);
      setOngoing([]);
      setHistory([]);
    }
  }, [cacheUser, currentUserId, setCacheUser, setLastQueueBySession, setLastQueueId, setQueueCache, setSessionCache]);

  const uniquePlayers = useMemo(() => {
    const seen = new Set<number>();
    const dedup: Player[] = [];
    players.forEach((p) => {
      const key = p.userId ?? p.id;
      if (seen.has(key)) return;
      seen.add(key);
      dedup.push(p);
    });
    return dedup;
  }, [players]);

  const queuedIds = useMemo(() => {
    const ids = new Set<number>();
    if (queue) queue.entries.forEach((e: QueueEntry) => ids.add(e.playerId));
    return ids;
  }, [queue]);

  const checkedInUserIds = useMemo(() => {
    if (!sessionDetail) return new Set<number>();
    return new Set(
      sessionDetail.members
        .filter((m) => m.status?.toLowerCase() === "checkedin")
        .map((m) => m.userId)
    );
  }, [sessionDetail]);

  async function runAction<T>(key: string, fn: () => Promise<T>, successMessage?: string) {
    setActionErr((prev) => ({ ...prev, [key]: null }));
    setLoading((prev) => ({ ...prev, [key]: true }));
    setInfo(null);
    try {
      const res = await fn();
      if (successMessage) setInfo(successMessage);
      return res;
    } catch (e: any) {
      const msg = e?.message || "Something went wrong";
      setActionErr((prev) => ({ ...prev, [key]: msg }));
      return null;
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  // Players
  useEffect(() => {
    refreshPlayers();
  }, [token]);

  async function refreshPlayers() {
    try {
      const res = await getPlayers(token);
      setPlayers(res);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  // Session detail (hydrate from cache then revalidate)
  useEffect(() => {
    if (!sessionIdFromRoute) {
      setSessionDetail(null);
      return;
    }
    const cached = sessionCache[sessionIdFromRoute];
    const now = Date.now();
    if (cached && now - cached.fetchedAt < 5 * 60 * 1000) {
      setSessionDetail(cached.detail);
    }
    (async () => {
      try {
        const detail = await getSessionDetail(sessionIdFromRoute, token);
        setSessionDetail(detail);
        setSessionCache((prev) => ({
          ...prev,
          [sessionIdFromRoute]: { detail, fetchedAt: Date.now() }
        }));
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [sessionCache, sessionIdFromRoute, setSessionCache, token]);

  // Hydrate queue from cache / last remembered queue
  useEffect(() => {
    const targetQueueId =
      sessionIdFromRoute && lastQueueBySession[sessionIdFromRoute]
        ? lastQueueBySession[sessionIdFromRoute]
        : lastQueueId;
    if (!targetQueueId) return;
    const cached = queueCache[targetQueueId];
    const now = Date.now();
    if (cached && now - cached.fetchedAt < 60 * 1000) {
      setQueue(cached.queue);
      setMode(cached.queue.mode);
    }
    loadQueue(targetQueueId);
  }, [lastQueueBySession, lastQueueId, queueCache, sessionIdFromRoute]);

  useEffect(() => {
    if (!queue || !queue.id) return;
    if (!sessionDetail) return;
    if (suppressSyncRef.current) return;
    syncCheckedInMembers(queue.id, queue);
  }, [queue, sessionDetail, players]);

  // If the session disappears (deleted/left), reset any attached queue.
  useEffect(() => {
    if (!sessionIdFromRoute) return;
    if (sessionDetail !== null) return;
    if (queue && queue.sessionId === sessionIdFromRoute) {
      resetQueueState(queue.id, sessionIdFromRoute);
      finishedQueueIdRef.current = null;
    }
  }, [sessionDetail, sessionIdFromRoute, queue]);

  async function syncCheckedInMembers(currentQueueId: number, currentQueue: QueueDetails) {
    if (syncingCheckinsRef.current) return;
    if (!sessionDetail) return;
    syncingCheckinsRef.current = true;
    try {
      const checkedMembers = sessionDetail.members.filter((m) => m.status?.toLowerCase() === "checkedin");
      let currentPlayers = players;
      if (currentPlayers.length === 0) {
        try {
          const fetched = await getPlayers(token);
          currentPlayers = fetched;
          setPlayers(fetched);
        } catch {
          // ignore fetch errors, proceed with empty
        }
      }
      const playerByUserId = new Map<number, Player>();
      currentPlayers.forEach((p) => {
        if (p.userId != null) playerByUserId.set(p.userId, p);
      });
      // Create missing players only when we have a userId (registered users) and we haven't already tried for that id.
      const missingMembers = checkedMembers.filter(
        (m) =>
          m.userId != null &&
          !playerByUserId.has(m.userId) &&
          !createdUserIdsRef.current.has(m.userId)
      );
      if (missingMembers.length > 0) {
        for (const m of missingMembers) {
          if (m.userId == null) continue;
          try {
            await createPlayer(m.name, true, token, m.userId);
            createdUserIdsRef.current.add(m.userId);
          } catch {
            // ignore and continue; we will surface a message below if still missing
          }
        }
        try {
          const fetched = await getPlayers(token);
          currentPlayers = fetched;
          setPlayers(fetched);
          playerByUserId.clear();
          currentPlayers.forEach((p) => {
            if (p.userId != null) playerByUserId.set(p.userId, p);
          });
        } catch {
          // ignore fetch errors; fallback to existing list
        }
      }
      // If any checked-in members still have no player record (likely no userId), inform the user.
      const stillMissing = checkedMembers.filter((m) => m.userId != null && !playerByUserId.has(m.userId));
      if (stillMissing.length > 0) {
        setInfo(
          `Some checked-in members have no player record (${stillMissing.length}). Add them manually to enqueue.`
        );
      }
      const checkedIds = new Set(checkedMembers.map((m) => m.userId));

      const inQueueIds = new Set(currentQueue.entries.map((e) => e.playerId));
      const toAdd: number[] = [];
      checkedIds.forEach((uid) => {
        const p = playerByUserId.get(uid);
        if (p && !inQueueIds.has(p.id)) toAdd.push(p.id);
      });

      const toRemove: number[] = [];
      currentQueue.entries.forEach((e) => {
        const player = players.find((p) => p.id === e.playerId);
        if (player?.userId && !checkedIds.has(player.userId)) {
          toRemove.push(e.playerId);
        }
      });

      if (toAdd.length === 0 && toRemove.length === 0) return;

      await Promise.all([
        ...toAdd.map((pid) => enqueueQueue(currentQueueId, pid, token).catch(() => null)),
        ...toRemove.map((pid) => removeFromQueue(currentQueueId, pid, token).catch(() => null))
      ]);
      await loadQueue(currentQueueId);
    } finally {
      syncingCheckinsRef.current = false;
    }
  }

  async function loadQueue(id: number): Promise<QueueDetails | null> {
    if (finishingQueueRef.current) return null;
    try {
      const res = await getQueueDetails(id, token);
      if (finishedQueueIdRef.current === id) {
        return null;
      }
      const normalizedMode =
        userModeChangedRef.current && queue?.id === res.id ? (queue?.mode ?? res.mode) : res.mode;
      const normalized: QueueDetails = {
        id: res.id,
        name: res.name,
        mode: normalizedMode,
        isOpen: res.isOpen,
        entries: res.entries || [],
        sessionId: res.sessionId ?? null
      };
      setQueue(normalized);
      if (!userModeChangedRef.current) {
        setMode(res.mode);
      }
      setQueueCache((prev) => ({
        ...prev,
        [id]: { queue: res, fetchedAt: Date.now() }
      }));
      setLastQueueId(id);
      if (res.sessionId) {
        setLastQueueBySession((prev) => ({ ...prev, [res.sessionId]: id }));
      } else if (sessionIdFromRoute) {
        setLastQueueBySession((prev) => ({ ...prev, [sessionIdFromRoute]: id }));
      }
      const ongoingRes = await getOngoingMatches(id, token);
      setOngoing(ongoingRes);
      const histRes = await getMatchHistory(id, token);
      setHistory(histRes);
      return normalized;
    } catch (e: any) {
      setErr(e.message);
      return null;
    }
  }

  const orderedQueue = useMemo(() => {
    if (!queue) return [];
    return [...queue.entries].sort((a, b) => {
      if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
  }, [queue]);

  const needed = mode === "Singles" ? 2 : 4;
  const nextMatch = orderedQueue.slice(0, needed);
  const hasNext = nextMatch.length === needed;

  useEffect(() => {
    setSelectedIds([]);
  }, [mode, queue?.id]);
  async function handleCreateQueue() {
    setFinishingQueue(false);
    await runAction(
      "createQueue",
      async () => {
        const res = await createQueue(queueName.trim() || "Queue", mode, token, sessionIdFromRoute);
        const q = await loadQueue(res.id);
        if (q && sessionDetail) {
          await syncCheckedInMembers(res.id, q);
        }
        return res;
      },
      "Queue created"
    );
  }

  async function handleAddPlayer() {
    const trimmed = newPlayerName.trim();
    if (!trimmed) {
      setActionErr((prev) => ({ ...prev, addPlayer: "Player name required" }));
      return;
    }
    const exists = uniquePlayers.some((p) => p.displayName.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setActionErr((prev) => ({ ...prev, addPlayer: "Name already exists" }));
      return;
    }
    await runAction(
      "addPlayer",
      async () => {
        await createPlayer(trimmed, false, token);
        setNewPlayerName("");
        await refreshPlayers();
      },
      "Player added"
    );
  }

  async function handleDeletePlayer(playerId: number) {
    await runAction(
      `delete-${playerId}`,
      async () => {
        suppressSyncRef.current = true;
        try {
          if (queue && queuedIds.has(playerId)) {
            await removeFromQueue(queue.id, playerId, token);
          }
          await deletePlayer(playerId, token);
          await refreshPlayers();
          if (queue) await loadQueue(queue.id);
        } finally {
          suppressSyncRef.current = false;
        }
      },
      "Player removed"
    );
  }

  async function handleEnqueue(playerId: number) {
    if (!queue) return;
    await runAction(
      `enqueue-${playerId}`,
      async () => {
        await enqueueQueue(queue.id, playerId, token);
        await loadQueue(queue.id);
      },
      "Added to queue"
    );
  }

  async function handleRemove(playerId: number) {
    if (!queue) return;
    await runAction(
      `remove-${playerId}`,
      async () => {
        await removeFromQueue(queue.id, playerId, token);
        await loadQueue(queue.id);
      },
      "Removed from queue"
    );
  }

  async function handleStartMatch() {
    if (!queue) return;
    await runAction(
      "startAuto",
      async () => {
        await startQueueMatch(queue.id, mode, token);
        await loadQueue(queue.id);
        await refreshPlayers();
      },
      "Match started"
    );
  }

  async function handleStartManualMatch() {
    if (!queue) return;
    if (selectedIds.length !== needed) {
      setActionErr((prev) => ({ ...prev, startManual: `Select exactly ${needed} players for ${mode.toLowerCase()}.` }));
      return;
    }
    await runAction(
      "startManual",
      async () => {
        await startQueueMatchManual(queue.id, selectedIds, mode, token);
        setSelectedIds([]);
        await loadQueue(queue.id);
        await refreshPlayers();
      },
      "Match started"
    );
  }

  async function handleFinishSpecific(matchId: number) {
    if (!queue) return;
    const match = ongoing.find((m) => m.id === matchId);
    if (!match) return;
    setFinishModal({ matchId, players: match.players });
    setWinnerId(null);
    setFinishMode("bo3");
    setSetScores([
      { a: "", b: "" },
      { a: "", b: "" },
      { a: "", b: "" }
    ]);
    setActionErr((prev) => ({ ...prev, finishMatch: null }));
  }

  async function submitFinishModal() {
    if (!queue || !finishModal.matchId) return;
    if (!winnerId) {
      setActionErr((prev) => ({ ...prev, finishMatch: "Select the winner." }));
      return;
    }
    const setsToUse = finishMode === "single" ? setScores.slice(0, 1) : setScores;
    const filled = setsToUse.filter((s) => s.a.trim() !== "" && s.b.trim() !== "");
    if (finishMode === "single" && filled.length < 1) {
      setActionErr((prev) => ({ ...prev, finishMatch: "Enter the set score." }));
      return;
    }
    if (finishMode === "bo3" && filled.length < 2) {
      setActionErr((prev) => ({ ...prev, finishMatch: "Enter at least two set scores." }));
      return;
    }

    let numericSets: { a: number; b: number }[];
    try {
      numericSets = filled.map((s, idx) => {
        const a = Number(s.a);
        const b = Number(s.b);
        if (Number.isNaN(a) || Number.isNaN(b)) throw new Error(`Set ${idx + 1} must be numbers`);
        return { a, b };
      });
    } catch (e: any) {
      setActionErr((prev) => ({ ...prev, finishMatch: e?.message || "Invalid scores" }));
      return;
    }

    await runAction(
      "finishMatch",
      async () => {
        await finishQueueMatch(queue.id, finishModal.matchId!, winnerId, numericSets, token);
        await loadQueue(queue.id);
        await refreshPlayers();
        setFinishModal({ matchId: null, players: [] });
        setWinnerId(null);
        setSetScores([
          { a: "", b: "" },
          { a: "", b: "" },
          { a: "", b: "" }
        ]);
      },
      "Match finished"
    );
  }

  async function handleStatusToggle() {
    if (!queue) return;
    await runAction("toggleStatus", async () => {
      await setQueueStatusQueue(queue.id, !queue.isOpen, token);
      await loadQueue(queue.id);
    });
  }

  function handleRemoveSelf(entries: QueueEntry[], name: string) {
    const match = entries.find((e) => e.displayName === name);
    if (match) handleRemove(match.playerId);
  }

  function handleFinishQueue() {
    if (!queue) return;
    if (finishingQueueRef.current) return;
    finishingQueueRef.current = true;
    setFinishingQueue(true);
    resetQueueState(queue.id, queue.sessionId ?? sessionIdFromRoute ?? null);
    finishedQueueIdRef.current = null;
    createdUserIdsRef.current.clear();
    setTimeout(() => {
      finishingQueueRef.current = false;
      setFinishingQueue(false);
    }, 150);
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <h3 className="mb-0">Queue Manager</h3>
        <span className="text-muted small">Create queue, manage players, run matches.</span>
      </div>

      {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}
      {info && <div className="alert alert-success py-2 mb-3" role="alert">{info}</div>}

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold py-2">Queue</div>
            <div className="card-body">
              {!queue ? (
                <>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Name</label>
                    <input
                      className="form-control"
                      value={queueName}
                      onChange={(e) => setQueueName(e.target.value)}
                    />
                  </div>
                  {sessionDetail && (
                    <div className="mb-2 small text-muted">
                      Session: {sessionDetail.name} ({sessionDetail.members.length} members)
                    </div>
                  )}
                  <button
                    className="btn btn-primary w-100"
                    disabled={loading.createQueue || !queueName.trim()}
                    onClick={handleCreateQueue}
                  >
                    {loading.createQueue && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                    Create queue
                  </button>
                  {actionErr.createQueue && <div className="text-danger small mt-2">{actionErr.createQueue}</div>}
                </>
              ) : (
                <>
                  <div className="mb-2 small">
                    <div><strong>Name:</strong> {queue.name}</div>
                    <div><strong>Status:</strong> {queue.isOpen ? "Open" : "Closed"}</div>
                    {queue.sessionId && sessionDetail && (
                      <div className="text-muted">Session: {sessionDetail.name}</div>
                    )}
                  </div>
                  <div className="d-flex flex-column gap-2">
                    <button
                      className="btn btn-outline-secondary w-100"
                      disabled={loading.toggleStatus}
                      onClick={handleStatusToggle}
                    >
                      {loading.toggleStatus && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                      {queue.isOpen ? "Close queue" : "Open queue"}
                    </button>
                    <button className="btn btn-outline-danger w-100" onClick={handleFinishQueue} disabled={finishingQueue}>
                      {finishingQueue && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                      Finish queue
                    </button>
                  </div>
                  {actionErr.toggleStatus && <div className="text-danger small mt-2">{actionErr.toggleStatus}</div>}
                </>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold py-2 d-flex align-items-center justify-content-between">
              <span>Players</span>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowAllPlayers(true)}
              >
                View all
              </button>
            </div>
            <div className="card-body">
              <div className="d-flex gap-2 mb-3">
                <input
                  className="form-control"
                  placeholder="Add player name"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  disabled={loading.addPlayer}
                />
                <button className="btn btn-success" disabled={loading.addPlayer} onClick={handleAddPlayer}>
                  {loading.addPlayer && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                  Add
                </button>
              </div>
              {actionErr.addPlayer && <div className="text-danger small mb-2">{actionErr.addPlayer}</div>}

              <div className="list-group list-group-flush" style={{ maxHeight: 260, overflowY: "auto" }}>
                {uniquePlayers.map((p) => {
                  const inQueue = queuedIds.has(p.id);
                  const enqueueKey = `enqueue-${p.id}`;
                  const deleteKey = `delete-${p.id}`;
                  const needsCheckIn =
                    sessionIdFromRoute &&
                    p.userId &&
                    !checkedInUserIds.has(p.userId);
                  return (
                    <div key={p.id} className="list-group-item d-flex align-items-center justify-content-between">
                      <div>
                        <div className="fw-semibold d-flex align-items-center gap-2">
                          {p.displayName}
                          {inQueue && <span className="badge bg-success-subtle text-success border border-success-subtle">In queue</span>}
                          {needsCheckIn && <span className="badge bg-warning text-dark">Needs check-in</span>}
                        </div>
                        <div className="text-muted small">Games: {p.gamesPlayed}</div>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          disabled={!queue || inQueue || loading[enqueueKey] || !!needsCheckIn}
                          onClick={() => queue && handleEnqueue(p.id)}
                        >
                          {loading[enqueueKey] && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                          {inQueue ? "In queue" : "Add to queue"}
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          disabled={loading[deleteKey]}
                          onClick={() => handleDeletePlayer(p.id)}
                        >
                          {loading[deleteKey] && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                {uniquePlayers.length === 0 && (
                  <div className="list-group-item text-muted small">No players yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-8">
          {queue ? (
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white fw-semibold py-2 d-flex justify-content-between align-items-center">
                <span>{queue.name}</span>
                <span className="badge bg-light text-muted">{orderedQueue.length} in queue</span>
              </div>
              <div className="card-body">
                <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                  <select
                    className="form-select form-select-sm"
                    style={{ maxWidth: 140 }}
                    value={mode}
                    onChange={async (e) => {
                      const newMode = e.target.value as "Singles" | "Doubles";
                      userModeChangedRef.current = true;
                      setMode(newMode);
                      setQueue((prev) => (prev ? { ...prev, mode: newMode } : prev));
                      if (queue) {
                        try {
                          await setQueueModeQueue(queue.id, newMode, token);
                          await loadQueue(queue.id);
                        } catch (err: any) {
                          setErr(err?.message || "Failed to update mode");
                        }
                      }
                    }}
                  >
                    <option>Singles</option>
                    <option>Doubles</option>
                  </select>

                  <div className="btn-group btn-group-sm" role="group" aria-label="Queue mode">
                    <button
                      type="button"
                      className={`btn ${tab === "auto" ? "btn-primary" : "btn-outline-secondary"}`}
                      onClick={() => setTab("auto")}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      className={`btn ${tab === "manual" ? "btn-primary" : "btn-outline-secondary"}`}
                      onClick={() => setTab("manual")}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      className={`btn ${tab === "ongoing" ? "btn-primary" : "btn-outline-secondary"}`}
                      onClick={() => setTab("ongoing")}
                    >
                      Playing now
                    </button>
                    <button
                      type="button"
                      className={`btn ${tab === "history" ? "btn-primary" : "btn-outline-secondary"}`}
                      onClick={() => setTab("history")}
                    >
                      History
                    </button>
                  </div>

                  <div className="ms-auto d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => handleRemoveSelf(orderedQueue, displayName)}>
                      Remove me
                    </button>
                  </div>
                </div>

                {tab === "auto" && (
                  <>
                    <div className="small text-muted mb-2">Ordered by fewest games, then join time.</div>
                    <ul className="list-group mb-3">
                      {orderedQueue.length === 0 && <li className="list-group-item small text-muted">Queue is empty.</li>}
                      {orderedQueue.map((e, idx) => (
                        <li key={e.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <strong>#{idx + 1}</strong> {e.displayName}
                          </div>
                          <div className="text-end small text-muted">
                            {e.gamesPlayed} games
                            <button className="btn btn-link btn-sm ms-2 p-0 text-danger" onClick={() => handleRemove(e.playerId)}>
                              remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small text-muted">Next match auto-selected</span>
                      <button className="btn btn-dark btn-sm" disabled={!hasNext || loading.startAuto} onClick={handleStartMatch}>
                        {loading.startAuto && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                        Start auto match
                      </button>
                    </div>
                    <NextMatch mode={mode} nextMatch={nextMatch} hasNext={hasNext} />
                    {actionErr.startAuto && <div className="text-danger small mt-2">{actionErr.startAuto}</div>}
                  </>
                )}

                {finishModal.matchId && (
                  <div
                    className="position-fixed top-0 start-0 w-100 h-100"
                    style={{ background: "rgba(0,0,0,0.35)", zIndex: 1060 }}
                    onClick={() => setFinishModal({ matchId: null, players: [] })}
                  >
                    <div
                      className="position-absolute top-50 start-50 translate-middle bg-white shadow rounded"
                      style={{ width: "520px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                        <h6 className="mb-0">Finish match #{finishModal.matchId}</h6>
                        <button className="btn-close" onClick={() => setFinishModal({ matchId: null, players: [] })} />
                      </div>
                      <div className="p-3">
                        <div className="mb-3">
                          <div className="fw-semibold mb-1">Winner</div>
                          {mode === "Doubles" && finishModal.players.length >= 4 ? (
                            <>
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  name="winner"
                                  id="winner-team-a"
                                  checked={winnerId === finishModal.players[0].id}
                                  onChange={() => setWinnerId(finishModal.players[0].id)}
                                />
                                <label className="form-check-label" htmlFor="winner-team-a">
                                  Team A: {finishModal.players[0].name} & {finishModal.players[1].name}
                                </label>
                              </div>
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  name="winner"
                                  id="winner-team-b"
                                  checked={winnerId === finishModal.players[2].id}
                                  onChange={() => setWinnerId(finishModal.players[2].id)}
                                />
                                <label className="form-check-label" htmlFor="winner-team-b">
                                  Team B: {finishModal.players[2].name} & {finishModal.players[3].name}
                                </label>
                              </div>
                            </>
                          ) : (
                            finishModal.players.map((p) => (
                              <div className="form-check" key={p.id}>
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  name="winner"
                                  id={`winner-${p.id}`}
                                  checked={winnerId === p.id}
                                  onChange={() => setWinnerId(p.id)}
                                />
                                <label className="form-check-label" htmlFor={`winner-${p.id}`}>
                                  {p.name}
                                </label>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="fw-semibold mb-2">Set scores</div>
                        <div className="btn-group btn-group-sm mb-2" role="group">
                          <button
                            type="button"
                            className={`btn ${finishMode === "bo3" ? "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => setFinishMode("bo3")}
                          >
                            Best of 3
                          </button>
                          <button
                            type="button"
                            className={`btn ${finishMode === "single" ? "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => setFinishMode("single")}
                          >
                            Single Set
                          </button>
                        </div>
                        {[0, 1, 2].map((idx) => (
                          <div
                            className={`d-flex align-items-center gap-2 mb-2 ${finishMode === "single" && idx > 0 ? "opacity-50" : ""}`}
                            key={idx}
                          >
                            <span className="text-muted small" style={{ width: 52 }}>Set {idx + 1}</span>
                            <input
                              type="number"
                              min="0"
                              className="form-control form-control-sm"
                              style={{ maxWidth: 80 }}
                              value={setScores[idx].a}
                              disabled={finishMode === "single" && idx > 0}
                              onChange={(e) => {
                                const next = [...setScores];
                                next[idx] = { ...next[idx], a: e.target.value };
                                setSetScores(next);
                              }}
                            />
                            <span className="text-muted">-</span>
                            <input
                              type="number"
                              min="0"
                              className="form-control form-control-sm"
                              style={{ maxWidth: 80 }}
                              value={setScores[idx].b}
                              disabled={finishMode === "single" && idx > 0}
                              onChange={(e) => {
                                const next = [...setScores];
                                next[idx] = { ...next[idx], b: e.target.value };
                                setSetScores(next);
                              }}
                            />
                            {idx === 2 && <span className="text-muted small">(optional third set)</span>}
                          </div>
                        ))}

                        {actionErr.finishMatch && <div className="text-danger small mb-2">{actionErr.finishMatch}</div>}

                        <div className="d-flex justify-content-end gap-2 mt-3">
                          <button className="btn btn-outline-secondary btn-sm" onClick={() => setFinishModal({ matchId: null, players: [] })}>
                            Cancel
                          </button>
                          <button className="btn btn-primary btn-sm" disabled={loading.finishMatch} onClick={submitFinishModal}>
                            {loading.finishMatch && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                            Finish match
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "manual" && (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small text-muted">Select exactly {needed} players to start a manual match.</span>
                      <div className="small">
                        <span className="badge bg-light text-muted">{selectedIds.length}/{needed} selected</span>
                      </div>
                    </div>
                    <ul className="list-group mb-3">
                      {orderedQueue.length === 0 && <li className="list-group-item small text-muted">Queue is empty.</li>}
                      {orderedQueue.map((e, idx) => {
                        const checked = selectedIds.includes(e.playerId);
                        const disableNewSelection = !checked && selectedIds.length >= needed;
                        return (
                          <li key={e.id} className="list-group-item d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={checked}
                                disabled={disableNewSelection}
                                onChange={() => {
                                  setSelectedIds((prev) =>
                                    prev.includes(e.playerId)
                                      ? prev.filter((id) => id !== e.playerId)
                                      : [...prev, e.playerId]
                                  );
                                }}
                              />
                              <div>
                                <strong>#{idx + 1}</strong> {e.displayName}
                                <div className="text-muted small">{e.gamesPlayed} games</div>
                              </div>
                            </div>
                            <button className="btn btn-link btn-sm text-danger p-0" onClick={() => handleRemove(e.playerId)}>
                              remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-dark btn-sm"
                        disabled={selectedIds.length !== needed || loading.startManual}
                        onClick={handleStartManualMatch}
                      >
                        {loading.startManual && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                        Start Match
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setSelectedIds([])}
                        disabled={selectedIds.length === 0}
                      >
                        Clear selection
                      </button>
                    </div>
                    {actionErr.startManual && <div className="text-danger small mt-2">{actionErr.startManual}</div>}
                  </>
                )}
                {tab === "ongoing" && (
                  <>
                    <div className="small text-muted mb-2">Finish matches here with winner + set scores.</div>
                    <ul className="list-group mb-3">
                      {ongoing.length === 0 && <li className="list-group-item small text-muted">No matches in progress.</li>}
                      {ongoing.map((m) => {
                        const isDoubles = mode === "Doubles" && m.players.length >= 4;
                        const teamA = isDoubles ? `${m.players[0].name} & ${m.players[1].name}` : m.players[0]?.name;
                        const teamB = isDoubles ? `${m.players[2].name} & ${m.players[3].name}` : m.players[1]?.name;
                        return (
                          <li key={m.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-start gap-2">
                              <div>
                                <div className="fw-semibold">Match #{m.id}</div>
                                <div className="small text-muted">
                                  {isDoubles ? `${teamA} vs ${teamB}` : m.players.map((p) => p.name).join(" vs ")}
                                </div>
                                {m.startedAt && (
                                  <div className="small text-muted">
                                    Started: {new Date(m.startedAt).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleFinishSpecific(m.id)}
                              >
                                Finish match
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {tab === "history" && (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small text-muted">Recent finished matches (last 50)</span>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => queue && getMatchHistory(queue.id, token).then(setHistory).catch((e) => setErr(e.message))}
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="list-group list-group-flush">
                      {history.length === 0 && (
                        <div className="list-group-item small text-muted">No finished matches yet.</div>
                      )}
                      {history.map((m) => {
                        const isDoubles = m.mode === "Doubles" && m.players.length >= 4;
                        const start = m.startTime ? new Date(m.startTime) : null;
                        const finish = m.finishTime ? new Date(m.finishTime) : null;
                        const duration = start && finish ? Math.max(0, Math.round((finish.getTime() - start.getTime()) / 60000)) : null;
                        const teamA = isDoubles ? `${m.players[0].name} & ${m.players[1].name}` : m.players[0]?.name;
                        const teamB = isDoubles ? `${m.players[2].name} & ${m.players[3].name}` : m.players[1]?.name;
                        return (
                          <div key={m.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-start gap-2">
                              <div>
                                <div className="fw-semibold">Match #{m.id} - {m.mode}</div>
                                <div className="small text-muted">
                                  {isDoubles ? `${teamA} vs ${teamB}` : m.players.map((p) => p.name).join(" vs ")}
                                </div>
                                {m.scoreText && <div className="small">{m.scoreText}</div>}
                                <div className="small text-muted">
                                  {start ? `Started: ${start.toLocaleString()}` : ""}
                                  {finish ? ` | Finished: ${finish.toLocaleString()}` : ""}
                                  {duration !== null ? ` | Duration: ${duration} min` : ""}
                                </div>
                              </div>
                              <span className="badge bg-light text-muted">{m.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-muted">Create a queue to begin.</div>
          )}
        </div>
      </div>

      {showAllPlayers && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ background: "rgba(0,0,0,0.35)", zIndex: 1050 }}
          onClick={() => setShowAllPlayers(false)}
        >
          <div
            className="position-absolute top-50 start-50 translate-middle bg-white shadow rounded"
            style={{ width: "520px", maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
              <h6 className="mb-0">All players ({uniquePlayers.length})</h6>
              <button className="btn-close" onClick={() => setShowAllPlayers(false)} />
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div className="d-flex gap-3">
                {chunk(uniquePlayers, 10).map((col, idx) => (
                  <div key={idx} className="list-group list-group-flush" style={{ minWidth: 240 }}>
                    {col.map((p) => {
                      const inQueue = queuedIds.has(p.id);
                      const enqueueKey = `enqueue-${p.id}`;
                      const deleteKey = `delete-${p.id}`;
                      const needsCheckIn =
                        sessionIdFromRoute &&
                        p.userId &&
                        !checkedInUserIds.has(p.userId);
                      return (
                        <div key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold d-flex align-items-center gap-2">
                              {p.displayName}
                              {inQueue && <span className="badge bg-success-subtle text-success border border-success-subtle">In queue</span>}
                              {needsCheckIn && <span className="badge bg-warning text-dark">Needs check-in</span>}
                            </div>
                            <div className="text-muted small">Games: {p.gamesPlayed}</div>
                          </div>
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              disabled={!queue || inQueue || loading[enqueueKey] || !!needsCheckIn}
                              onClick={() => queue && handleEnqueue(p.id)}
                            >
                              {loading[enqueueKey] && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                              {inQueue ? "In queue" : "Add to queue"}
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={loading[deleteKey]}
                              onClick={() => handleDeletePlayer(p.id)}
                            >
                              {loading[deleteKey] && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {uniquePlayers.length === 0 && (
                  <div className="list-group-item text-muted small">No players yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NextMatch({ mode, nextMatch, hasNext }: { mode: "Singles" | "Doubles"; nextMatch: QueueEntry[]; hasNext: boolean }) {
  const needed = mode === "Singles" ? 2 : 4;
  return (
    <div className="border rounded p-3 bg-light">
      <div className="d-flex justify-content-between mb-2">
        <div className="fw-semibold">Next match</div>
        <span className="text-muted small">{mode} - need {needed}</span>
      </div>
      {hasNext ? (
        mode === "Singles" ? (
          <div className="d-flex justify-content-between small">
            <span>{nextMatch[0].displayName}</span>
            <span className="text-muted">vs</span>
            <span>{nextMatch[1].displayName}</span>
          </div>
        ) : (
          <div className="row g-2 small">
            <div className="col-6">
              <div className="p-2 bg-white rounded border">
                <div className="fw-semibold mb-1">Team A</div>
                <div>{nextMatch[0].displayName}</div>
                <div>{nextMatch[1].displayName}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="p-2 bg-white rounded border">
                <div className="fw-semibold mb-1">Team B</div>
                <div>{nextMatch[2].displayName}</div>
                <div>{nextMatch[3].displayName}</div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="text-muted small">Waiting for more players.</div>
      )}
    </div>
  );
}

