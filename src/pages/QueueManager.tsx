import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { tokenAtom, nameAtom } from "../state/auth";
import {
  createPlayer,
  createQueue,
  enqueueQueue,
  finishQueueMatch,
  getPlayers,
  getQueueDetails,
  removeFromQueue,
  setQueueStatusQueue,
  startQueueMatch,
  startQueueMatchManual,
  getOngoingMatches,
  deletePlayer,
  getMatchHistory
} from "../api/client";
import "bootstrap/dist/css/bootstrap.min.css";

type Player = {
  id: number;
  displayName: string;
  gamesPlayed: number;
  isRegistered: boolean;
};

type QueueEntry = {
  id: number;
  position: number;
  playerId: number;
  displayName: string;
  gamesPlayed: number;
  joinedAt: string;
};

type QueueDetails = {
  id: number;
  name: string;
  mode: "Singles" | "Doubles";
  isOpen: boolean;
  entries: QueueEntry[];
};

type OngoingMatch = {
  id: number;
  startedAt: string;
  players: { id: number; name: string }[];
};

type MatchHistory = {
  id: number;
  status: string;
  mode: string;
  startTime?: string;
  finishTime?: string;
  scoreText?: string;
  players: { id: number; name: string }[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function QueueManager() {
  const token = useAtomValue(tokenAtom)!;
  const displayName = useAtomValue(nameAtom) || "You";
  const [players, setPlayers] = useState<Player[]>([]);
  const [queue, setQueue] = useState<QueueDetails | null>(null);
  const [mode, setMode] = useState<"Singles" | "Doubles">("Singles");
  const [queueName, setQueueName] = useState("Main Queue");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [lastMatchId, setLastMatchId] = useState<number | null>(null);
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
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    refreshPlayers();
  }, [token]);

  useEffect(() => {
    if (queue) {
      loadQueue(queue.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function refreshPlayers() {
    try {
      const res = await getPlayers(token);
      setPlayers(res);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function loadQueue(id: number) {
    try {
      const res = await getQueueDetails(id, token);
      setQueue({
        id: res.id,
        name: res.name,
        mode: res.mode,
        isOpen: res.isOpen,
        entries: res.entries || []
      });
      const ongoingRes = await getOngoingMatches(id, token);
      setOngoing(ongoingRes);
      const histRes = await getMatchHistory(id, token);
      setHistory(histRes);
    } catch (e: any) {
      setErr(e.message);
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
    try {
      const res = await createQueue(queueName || "Queue", mode, token);
      await loadQueue(res.id);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleAddPlayer() {
    if (!newPlayerName.trim()) {
      setErr("Player name required");
      return;
    }
    try {
      await createPlayer(newPlayerName.trim(), false, token);
      setNewPlayerName("");
      await refreshPlayers();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleDeletePlayer(playerId: number) {
    try {
      await deletePlayer(playerId, token);
      await refreshPlayers();
      if (queue) await loadQueue(queue.id);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleEnqueue(playerId: number) {
    if (!queue) return;
    try {
      await enqueueQueue(queue.id, playerId, token);
      await loadQueue(queue.id);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleRemove(playerId: number) {
    if (!queue) return;
    try {
      await removeFromQueue(queue.id, playerId, token);
      await loadQueue(queue.id);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleStartMatch() {
    if (!queue) return;
    try {
      const res = await startQueueMatch(queue.id, mode, token);
      setLastMatchId(res.matchId);
      await loadQueue(queue.id);
      await refreshPlayers();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleStartManualMatch() {
    if (!queue) return;
    if (selectedIds.length !== needed) {
      setErr(`Select exactly ${needed} players for ${mode.toLowerCase()}.`);
      return;
    }
    try {
      const res = await startQueueMatchManual(queue.id, selectedIds, mode, token);
      setLastMatchId(res.matchId);
      setSelectedIds([]);
      await loadQueue(queue.id);
      await refreshPlayers();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleFinishSpecific(matchId: number) {
    if (!queue) return;
    try {
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
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function submitFinishModal() {
    if (!queue || !finishModal.matchId) return;
    if (!winnerId) {
      setErr("Select the winner.");
      return;
    }
    const filled = finishMode === "single"
      ? setScores.slice(0, 1).filter((s) => s.a.trim() !== "" && s.b.trim() !== "")
      : setScores.filter((s) => s.a.trim() !== "" && s.b.trim() !== "");
    if (finishMode === "single" && filled.length < 1) {
      setErr("Enter the set score.");
      return;
    }
    if (finishMode === "bo3" && filled.length < 2) {
      setErr("Enter at least two set scores.");
      return;
    }
    const winnerName = finishModal.players.find((p) => p.id === winnerId)?.name || `Player ${winnerId}`;
    const setText = filled
      .map((s, idx) => `Set ${idx + 1} ${s.a}-${s.b}`)
      .join(", ");
    const scoreText = `Winner: ${winnerName} | Mode: ${finishMode === "single" ? "1 set to 31" : "Best of 3"} | ${setText}`;
    try {
      await finishQueueMatch(queue.id, finishModal.matchId, scoreText, token);
      await loadQueue(queue.id);
      await refreshPlayers();
      setFinishModal({ matchId: null, players: [] });
      setWinnerId(null);
      setSetScores([
        { a: "", b: "" },
        { a: "", b: "" },
        { a: "", b: "" }
      ]);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleStatusToggle() {
    if (!queue) return;
    try {
      await setQueueStatusQueue(queue.id, !queue.isOpen, token);
      await loadQueue(queue.id);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap gap=2 align-items-center mb-3">
        <h3 className="mb-0">Queue Manager</h3>
        <span className="text-muted small   ">Create queue, manage players, run matches.</span>
      </div>

      {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold py-2">Queue</div>
            <div className="card-body">
              {!queue ? (
                <>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Name</label>
                    <input className="form-control" value={queueName} onChange={(e) => setQueueName(e.target.value)} />
                  </div>
                  <button className="btn btn-primary w-100" onClick={handleCreateQueue}>Create queue</button>
                </>
              ) : (
                <>
                  <div className="mb-2 small">
                    <div><strong>Name:</strong> {queue.name}</div>
                    <div><strong>Status:</strong> {queue.isOpen ? "Open" : "Closed"}</div>
                  </div>
                  <button className="btn btn-outline-secondary w-100" onClick={handleStatusToggle}>
                    {queue.isOpen ? "Close queue" : "Open queue"}
                  </button>
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
                />
                <button className="btn btn-success" onClick={handleAddPlayer}>Add</button>
              </div>

              <div className="list-group list-group-flush" style={{ maxHeight: 260, overflowY: "auto" }}>
                {players.map((p) => (
                  <div key={p.id} className="list-group-item d-flex align-items-center justify-content-between">
                    <div>
                      <div className="fw-semibold">{p.displayName}</div>
                      <div className="text-muted small">Games: {p.gamesPlayed}</div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={!queue}
                        onClick={() => queue && handleEnqueue(p.id)}
                      >
                        Add to queue
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeletePlayer(p.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {players.length === 0 && (
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
                <span>{queue.name} - {queue.mode}</span>
                <span className="badge bg-light text-muted">{orderedQueue.length} in queue</span>
              </div>
              <div className="card-body">
                <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                  <select
                    className="form-select form-select-sm"
                    style={{ maxWidth: 140 }}
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
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
                      <button className="btn btn-dark btn-sm background-color green" disabled={!hasNext} onClick={handleStartMatch}>
                        Start auto match
                      </button>
                    </div>
                    <NextMatch mode={mode} nextMatch={nextMatch} hasNext={hasNext} />
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
                {finishModal.players.map((p) => (
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
                ))}
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

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setFinishModal({ matchId: null, players: [] })}>
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={submitFinishModal}>
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
                        disabled={selectedIds.length !== needed}
                        onClick={handleStartManualMatch}
                      >
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
                  </>
                )}

                {tab === "ongoing" && (
                  <>
                    <div className="small text-muted mb-2">Finish matches here with winner + set scores.</div>
                    <ul className="list-group mb-3">
                      {ongoing.length === 0 && <li className="list-group-item small text-muted">No matches in progress.</li>}
                      {ongoing.map((m) => (
                        <li key={m.id} className="list-group-item">
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div>
                              <div className="fw-semibold">Match #{m.id}</div>
                              <div className="small text-muted">
                                {m.players.map(p => p.name).join(" vs ")}
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
                      ))}
                    </ul>
                  </>
                )}

                {tab === "history" && (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small text-muted">Recent finished matches (last 50)</span>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => queue && getMatchHistory(queue.id, token).then(setHistory).catch(e => setErr(e.message))}
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="list-group list-group-flush">
                      {history.length === 0 && (
                        <div className="list-group-item small text-muted">No finished matches yet.</div>
                      )}
                      {history.map((m) => (
                        <div key={m.id} className="list-group-item">
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div>
                              <div className="fw-semibold">Match #{m.id} · {m.mode}</div>
                              <div className="small text-muted">{m.players.map(p => p.name).join(" vs ")}</div>
                              {m.scoreText && <div className="small">{m.scoreText}</div>}
                              <div className="small text-muted">
                                {m.startTime ? `Started: ${new Date(m.startTime).toLocaleString()}` : ""}
                                {m.finishTime ? ` · Finished: ${new Date(m.finishTime).toLocaleString()}` : ""}
                              </div>
                            </div>
                            <span className="badge bg-light text-muted">{m.status}</span>
                          </div>
                        </div>
                      ))}
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
              <h6 className="mb-0">All players ({players.length})</h6>
              <button className="btn-close" onClick={() => setShowAllPlayers(false)} />
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div className="d-flex gap-3">
                {chunk(players, 10).map((col, idx) => (
                  <div key={idx} className="list-group list-group-flush" style={{ minWidth: 240 }}>
                    {col.map((p) => (
                      <div key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-semibold">{p.displayName}</div>
                          <div className="text-muted small">Games: {p.gamesPlayed}</div>
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={!queue}
                            onClick={() => queue && handleEnqueue(p.id)}
                          >
                            Add to queue
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeletePlayer(p.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {players.length === 0 && (
                  <div className="list-group-item text-muted small">No players yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleRemoveSelf(entries: QueueEntry[], name: string) {
    const match = entries.find(e => e.displayName === name);
    if (match) handleRemove(match.playerId);
  }
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
