import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { tokenAtom } from "../state/auth";
import {
  listSessions,
  createSession,
  joinSession,
  leaveSession,
  getSessionDetail,
  checkInSession,
  checkOutSession
} from "../api/client";
import type { SessionDetail, SessionListItem, SessionMember } from "../types/session";
import { deleteSession } from "../api/client";

type ActionFlags = Record<string, boolean>;
type ActionErrors = Record<string, string | null>;

function decodeUserId(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload));
    const sub = json.sub ?? json.nameid ?? json["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    const parsed = Number(sub);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function Sessions() {
  const token = useAtomValue(tokenAtom)!;
  const userId = decodeUserId(token);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState<ActionFlags>({});
  const [err, setErr] = useState<ActionErrors>({});
  const [info, setInfo] = useState<string | null>(null);

  const isOwner = useMemo(() => detail && userId !== null && detail.ownerUserId === userId, [detail, userId]);
  const isCoHost = useMemo(() => {
    if (!detail || userId === null) return false;
    return detail.members.some((m) => m.userId === userId && m.role === "CoHost");
  }, [detail, userId]);

  const canManageMembers = isOwner || isCoHost;

  async function run<T>(key: string, fn: () => Promise<T>, success?: string) {
    setErr((p) => ({ ...p, [key]: null }));
    setLoading((p) => ({ ...p, [key]: true }));
    setInfo(null);
    try {
      const res = await fn();
      if (success) setInfo(success);
      return res;
    } catch (e: any) {
      setErr((p) => ({ ...p, [key]: e?.message || "Error" }));
      return null;
    } finally {
      setLoading((p) => ({ ...p, [key]: false }));
    }
  }

  async function refreshList() {
    await run("list", async () => {
      const data = await listSessions(token, search || undefined);
      setSessions(data);
      return data;
    });
  }

  async function loadDetail(id: number) {
    setSelectedId(id);
    const res = await run("detail", async () => getSessionDetail(id, token));
    if (res) setDetail(res);
  }

  useEffect(() => {
    refreshList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    if (!newName.trim()) {
      setErr((p) => ({ ...p, create: "Name required" }));
      return;
    }
    await run("create", async () => {
      await createSession(newName.trim(), newDesc.trim() || undefined, isPublic, token);
      setNewName("");
      setNewDesc("");
      setIsPublic(true);
      await refreshList();
    }, "Session created");
  }

  async function handleJoin(id: number) {
    await run(`join-${id}`, async () => {
      await joinSession(id, token);
      await refreshList();
      if (selectedId === id) await loadDetail(id);
    }, "Joined");
  }

  async function handleLeave(id: number) {
    await run(`leave-${id}`, async () => {
      await leaveSession(id, token);
      await refreshList();
      if (selectedId === id) {
        setDetail(null);
        setSelectedId(null);
      }
    }, "Left session");
  }

  async function handleCheck(member: SessionMember, toCheckedIn: boolean) {
    if (!detail) return;
    const key = `${toCheckedIn ? "checkin" : "checkout"}-${member.userId}`;
    await run(key, async () => {
      if (toCheckedIn) {
        await checkInSession(detail.id, member.userId, token);
      } else {
        await checkOutSession(detail.id, member.userId, token);
      }
      await loadDetail(detail.id);
    }, toCheckedIn ? "Checked in" : "Checked out");
  }

  async function handleDeleteSession() {
    if (!detail) return;
    await run("deleteSession", async () => {
      await deleteSession(detail.id, token);
      setDetail(null);
      setSelectedId(null);
      await refreshList();
    }, "Session deleted");
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-0">Sessions</h3>
          <div className="text-muted small">Create/find sessions, join, and check in members.</div>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={refreshList} disabled={loading.list}>
          Refresh
        </button>
      </div>

      {info && <div className="alert alert-success py-2">{info}</div>}
      {Object.values(err).some(Boolean) && (
        <div className="alert alert-danger py-2">{Object.values(err).find(Boolean)}</div>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold py-2">Search & Create</div>
            <div className="card-body">
              <div className="input-group mb-3">
                <input
                  className="form-control"
                  placeholder="Search sessions"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className="btn btn-outline-secondary" disabled={loading.list} onClick={refreshList}>
                  Search
                </button>
              </div>

              <div className="border rounded p-3">
                <div className="fw-semibold mb-2">Create session</div>
                <div className="mb-2">
                  <label className="form-label small">Name</label>
                  <input className="form-control" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="session-public"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="session-public">Public (discoverable)</label>
                </div>
                <button className="btn btn-primary" disabled={loading.create} onClick={handleCreate}>
                  {loading.create && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                  Create session
                </button>
                {err.create && <div className="text-danger small mt-2">{err.create}</div>}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold py-2">Sessions</div>
            <div className="list-group list-group-flush" style={{ maxHeight: 420, overflowY: "auto" }}>
              {sessions.map((s) => (
                <div key={s.id} className={`list-group-item d-flex align-items-center justify-content-between ${selectedId === s.id ? "bg-light" : ""}`}>
                  <div>
                    <div className="fw-semibold">{s.name} {s.isPublic ? "" : <span className="badge bg-secondary ms-1">Private</span>}</div>
                    <div className="text-muted small">
                      Owner: {s.ownerName} · Members: {s.members} · {s.myStatus ? `You: ${s.myStatus}` : "Not joined"}
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => loadDetail(s.id)}>
                      View
                    </button>
                    {s.myStatus ? (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={loading[`leave-${s.id}`]}
                        onClick={() => handleLeave(s.id)}
                      >
                        Leave
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={loading[`join-${s.id}`]}
                        onClick={() => handleJoin(s.id)}
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="list-group-item text-muted small">No sessions found.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold py-2 d-flex justify-content-between align-items-center">
              <span>Details</span>
              {detail && (
                <div className="d-flex gap-2">
                  {(isOwner || isCoHost) && (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      disabled={loading.deleteSession}
                      onClick={handleDeleteSession}
                    >
                      {loading.deleteSession && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                      Delete session
                    </button>
                  )}
                  <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/queue-manager/${detail.id}`)}>
                    Open queue manager
                  </button>
                </div>
              )}
            </div>
            <div className="card-body">
              {!detail ? (
                <div className="text-muted small">Select a session to view details.</div>
              ) : (
                <>
                  <div className="mb-2">
                    <div className="fw-semibold">{detail.name}</div>
                    <div className="text-muted small">{detail.description || "No description"}</div>
                    <div className="text-muted small">Owner: {detail.ownerName}</div>
                    <div className="badge bg-light text-muted mt-1">{detail.isPublic ? "Public" : "Private"}</div>
                  </div>

                  <div className="fw-semibold mb-2">Members</div>
                  <div className="list-group list-group-flush" style={{ maxHeight: 320, overflowY: "auto" }}>
                    {detail.members.map((m) => (
                      <div key={m.userId} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-semibold d-flex align-items-center gap-2">
                            {m.name}
                            <span className="badge bg-light text-muted">{m.role}</span>
                          </div>
                          <div className="text-muted small">Status: {m.status}</div>
                        </div>
                        {canManageMembers && (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              disabled={m.status === "CheckedIn" || loading[`checkin-${m.userId}`]}
                              onClick={() => handleCheck(m, true)}
                            >
                              {loading[`checkin-${m.userId}`] && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                              Check-in
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={m.status !== "CheckedIn" || loading[`checkout-${m.userId}`]}
                              onClick={() => handleCheck(m, false)}
                            >
                              {loading[`checkout-${m.userId}`] && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                              Check-out
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {detail.members.length === 0 && (
                      <div className="list-group-item text-muted small">No members yet.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
