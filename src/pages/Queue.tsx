import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { tokenAtom, roleAtom } from "../state/auth";
import { enqueueSelf, getQueue, leaveSelf, setQueueStatus } from "../api/client";

export default function QueuePage() {
  const { courtId } = useParams();
  const token = useAtomValue(tokenAtom)!;
  const role = useAtomValue(roleAtom);
  const [mode, setMode] = useState<"Singles" | "Doubles">("Singles");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isQM = role === "QueueMaster" || role === "Admin";

  async function load() {
    if (!courtId) return;
    try {
      setLoading(true);
      setErr(null);
      const q = await getQueue(Number(courtId), mode, token);
      setData(q);
    } catch (e: any) {
      setErr(e.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [courtId, mode, token]);

  async function runAction(fn: () => Promise<void>) {
    try {
      setActionLoading(true);
      setErr(null);
      await fn();
      await load();
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  const handleJoin = () =>
    runAction(() => enqueueSelf(Number(courtId!), mode, token));

  const handleLeave = () =>
    runAction(() => leaveSelf(Number(courtId!), mode, token));

  const handleSetStatus = (isOpen: boolean) =>
    runAction(() => setQueueStatus(Number(courtId!), mode, isOpen, token));

  const entries = data?.entries ?? [];

  const displayName = (e: any) =>
    e?.userDisplayName ||
    (e?.userId ? `User ${e.userId}` : e?.guestSessionId ? `Guest ${e.guestSessionId}` : "Empty slot");

  const lineup = entries.slice(0, mode === "Singles" ? 2 : 4);
  const teamA = lineup.slice(0, 2);
  const teamB = mode === "Singles" ? lineup.slice(1, 2) : lineup.slice(2, 4);
  const waiting = entries.slice(mode === "Singles" ? 2 : 4);

  const courtDisabled = !data?.isOpen || loading || actionLoading;

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h3 className="mb-1">Court {courtId}</h3>
          {data && (
            <div className="d-flex flex-wrap gap-2">
              <span className={`badge ${data.isOpen ? "bg-success" : "bg-danger"}`}>
                {data.isOpen ? "OPEN" : "CLOSED"}
              </span>
              <span className="text-muted">Mode: {data.mode}</span>
              <span className="text-muted">{entries.length} in queue</span>
            </div>
          )}
        </div>

        <div className="d-flex align-items-center gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: 130 }}
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            disabled={actionLoading}
          >
            <option>Singles</option>
            <option>Doubles</option>
          </select>

          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={loading}
            onClick={load}
          >
            {loading && (
              <span className="spinner-border spinner-border-sm me-1" role="status" />
            )}
            Refresh
          </button>

          {isQM && (
            <>
              <button
                className="btn btn-sm btn-success"
                disabled={actionLoading}
                onClick={() => handleSetStatus(true)}
              >
                Open
              </button>
              <button
                className="btn btn-sm btn-danger"
                disabled={actionLoading}
                onClick={() => handleSetStatus(false)}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>

      {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

      {data && (
        <div className="row g-4">
          {/* LEFT: Court */}
          <div className="col-12 col-md-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header py-2 bg-white fw-semibold">Court layout</div>
              <div className="card-body">
                <div className="border rounded p-3 bg-light">
                  {/* Singles mode */}
                  {mode === "Singles" && (
                    <>
                      <div className="mb-3">
                        <div className="border rounded p-3 text-center bg-white">
                          <div className="small text-muted mb-2">Player 1</div>
                          <button
                            className="btn btn-light btn-sm w-100"
                            disabled={courtDisabled}
                            onClick={handleJoin}
                          >
                            Join
                          </button>
                        </div>
                      </div>

                      <div className="text-center text-muted small py-2 border-top border-bottom mb-3">
                        NET
                      </div>

                      <div>
                        <div className="border rounded p-3 text-center bg-white">
                          <div className="small text-muted mb-2">Player 2</div>
                          <button
                            className="btn btn-light btn-sm w-100"
                            disabled={courtDisabled}
                            onClick={handleJoin}
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Doubles mode */}
                  {mode === "Doubles" && (
                    <>
                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <div className="border rounded p-3 text-center bg-white">
                            <div className="small text-muted mb-1">Player 1</div>
                            <button
                              className="btn btn-light btn-sm w-100"
                              disabled={courtDisabled}
                              onClick={handleJoin}
                            >
                              Join
                            </button>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="border rounded p-3 text-center bg-white">
                            <div className="small text-muted mb-1">Player 2</div>
                            <button
                              className="btn btn-light btn-sm w-100"
                              disabled={courtDisabled}
                              onClick={handleJoin}
                            >
                              Join
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-center text-muted small py-2 border-top border-bottom mb-2">
                        NET
                      </div>

                      <div className="row g-2">
                        <div className="col-6">
                          <div className="border rounded p-3 text-center bg-white">
                            <div className="small text-muted mb-1">Player 3</div>
                            <button
                              className="btn btn-light btn-sm w-100"
                              disabled={courtDisabled}
                              onClick={handleJoin}
                            >
                              Join
                            </button>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="border rounded p-3 text-center bg-white">
                            <div className="small text-muted mb-1">Player 4</div>
                            <button
                              className="btn btn-light btn-sm w-100"
                              disabled={courtDisabled}
                              onClick={handleJoin}
                            >
                              Join
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button
                    className="btn btn-dark flex-grow-1"
                    disabled={courtDisabled}
                    onClick={handleJoin}
                  >
                    {actionLoading ? "Joining..." : "Quick join"}
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    disabled={loading || actionLoading}
                    onClick={handleLeave}
                  >
                    Leave queue
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Preview + waiting */}
          <div className="col-12 col-md-5">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header py-2 bg-white fw-semibold">Next matchup preview</div>
              <div className="card-body">
                <div className="small text-muted mb-2">
                  Top of the queue will play next.
                </div>

                <div className="d-flex justify-content-between mb-3">
                  <div>
                    <div className="fw-bold mb-1">Team A</div>
                    <div className="small">
                      {displayName(teamA[0])}
                      {mode === "Doubles" && (
                        <>
                          <br />
                          {displayName(teamA[1])}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="fw-bold text-muted align-self-center">VS</div>

                  <div className="text-end">
                    <div className="fw-bold mb-1">Team B</div>
                    <div className="small">
                      {displayName(teamB[0])}
                      {mode === "Doubles" && (
                        <>
                          <br />
                          {displayName(teamB[1])}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {entries.length === 0 && (
                  <p className="small text-muted mb-0">
                    Queue is empty. Players will appear here once they join.
                  </p>
                )}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header py-2 d-flex justify-content-between bg-white">
                <span>Waiting list</span>
                <span className="badge bg-light text-muted">
                  {waiting.length}
                </span>
              </div>
              <ul className="list-group list-group-flush mb-0">
                {waiting.length ? (
                  waiting.map((e: any) => (
                    <li
                      className="list-group-item small"
                      key={e.id}
                    >
                      #{e.position} - {displayName(e)}
                    </li>
                  ))
                ) : (
                  <li className="list-group-item small text-muted fst-italic">
                    No one waiting after the next matchup.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
