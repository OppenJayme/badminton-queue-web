import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { nameAtom } from "../state/auth";
import "bootstrap/dist/css/bootstrap.min.css";

type Player = {
  id: number;
  name: string;
  games: number;
  isQM: boolean;
};

type QueueEntry = {
  playerId: number;
  joinedAt: number;
};

export default function Groups() {
  const displayName = useAtomValue(nameAtom) || "You";
  const [group, setGroup] = useState<{
    name: string;
    location: string;
    courts: number;
    hours: number;
  } | null>(null);
  const [form, setForm] = useState({ name: "", location: "", courts: 2, hours: 2 });
  const [roster, setRoster] = useState<Player[]>([
    { id: 1, name: displayName, games: 0, isQM: true }
  ]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [mode, setMode] = useState<"Singles" | "Doubles">("Singles");
  const [err, setErr] = useState<string | null>(null);

  const orderedQueue = useMemo(() => {
    const rosterLookup = new Map(roster.map((r) => [r.id, r]));
    return [...queueEntries]
      .map((q) => ({ ...q, player: rosterLookup.get(q.playerId)! }))
      .filter((q) => q.player)
      .sort((a, b) => {
        if (a.player.games !== b.player.games) return a.player.games - b.player.games;
        return a.joinedAt - b.joinedAt;
      });
  }, [queueEntries, roster]);

  const nextMatch = orderedQueue.slice(0, mode === "Singles" ? 2 : 4);

  function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.location.trim()) {
      setErr("Group name and location are required.");
      return;
    }
    setErr(null);
    setGroup({
      name: form.name.trim(),
      location: form.location.trim(),
      courts: form.courts,
      hours: form.hours,
    });
    if (!roster.some((r) => r.name === displayName)) {
      setRoster((prev) => [...prev, { id: prev.length + 1, name: displayName, games: 0, isQM: true }]);
    }
  }

  function addPlayer(name: string) {
    if (!name.trim()) return;
    setRoster((prev) => [...prev, { id: prev.length + 1, name: name.trim(), games: 0, isQM: false }]);
  }

  function toggleQM(id: number) {
    setRoster((prev) => prev.map((p) => (p.id === id ? { ...p, isQM: !p.isQM } : p)));
  }

  function enqueuePlayer(id: number) {
    setQueueEntries((prev) => [...prev, { playerId: id, joinedAt: Date.now() }]);
  }

  function dequeueForMatch() {
    const needed = mode === "Singles" ? 2 : 4;
    if (orderedQueue.length < needed) {
      setErr("Not enough players in queue for this mode.");
      return;
    }
    setErr(null);
    const selectedIds = new Set(nextMatch.map((p) => p.playerId));

    setRoster((prev) =>
      prev.map((p) => (selectedIds.has(p.id) ? { ...p, games: p.games + 1 } : p))
    );
    setQueueEntries((prev) => prev.filter((q) => !selectedIds.has(q.playerId)));
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap align-items-baseline gap-3 mb-3">
        <h2 className="mb-0">Groups</h2>
        <span className="text-muted">Create a play group, manage QMs, and balance games.</span>
      </div>

      {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold py-2">Create / edit group</div>
            <div className="card-body">
              <form onSubmit={handleCreateGroup} className="d-flex flex-column gap-3">
                <div>
                  <label className="form-label fw-semibold">Group name</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Badminton Tuesdays"
                  />
                </div>
                <div>
                  <label className="form-label fw-semibold">Preferred location</label>
                  <input
                    className="form-control"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Club / city"
                  />
                </div>
                <div className="d-flex gap-2">
                  <div className="flex-1">
                    <label className="form-label fw-semibold">Courts</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="form-control"
                      value={form.courts}
                      onChange={(e) => setForm({ ...form, courts: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="form-label fw-semibold">Hours</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      className="form-control"
                      value={form.hours}
                      onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn text-white" style={{ backgroundColor: "#0ea5e9" }}>
                  {group ? "Update group" : "Create group"}
                </button>
              </form>

              {group && (
                <div className="mt-3 small text-muted">
                  Owner: <strong>{displayName}</strong> (QueueMaster). Invite players and mark other QMs below.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold py-2 d-flex justify-content-between">
              <span>Group overview</span>
              <span className="text-muted small">{group ? "Drafted" : "Fill details to create group"}</span>
            </div>
            <div className="card-body">
              {group ? (
                <div className="row g-3">
                  <div className="col-6 col-md-3">
                    <div className="text-muted small">Name</div>
                    <div className="fw-semibold">{group.name}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="text-muted small">Location</div>
                    <div className="fw-semibold">{group.location}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="text-muted small">Courts</div>
                    <div className="fw-semibold">{group.courts}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="text-muted small">Hours</div>
                    <div className="fw-semibold">{group.hours}</div>
                  </div>
                </div>
              ) : (
                <div className="text-muted">Create a group to start managing players and queue.</div>
              )}
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-6">
              <RosterCard
                roster={roster}
                onAdd={addPlayer}
                onToggleQM={toggleQM}
                enqueue={enqueuePlayer}
              />
            </div>
            <div className="col-12 col-md-6">
              <QueueCard
                mode={mode}
                onModeChange={setMode}
                orderedQueue={orderedQueue}
                roster={roster}
                nextMatch={nextMatch}
                dequeueForMatch={dequeueForMatch}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RosterCard({
  roster,
  onAdd,
  onToggleQM,
  enqueue
}: {
  roster: Player[];
  onAdd: (name: string) => void;
  onToggleQM: (id: number) => void;
  enqueue: (id: number) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white fw-semibold py-2">Players & QMs</div>
      <div className="card-body">
        <div className="d-flex gap-2 mb-3">
          <input
            className="form-control"
            placeholder="Add player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-outline-primary" onClick={() => { onAdd(name); setName(""); }}>
            Add
          </button>
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Games</th>
                <th>QM</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="text-muted">{p.games}</td>
                  <td>
                    <span
                      className={`badge ${p.isQM ? "bg-success" : "bg-light text-muted"}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => onToggleQM(p.id)}
                    >
                      {p.isQM ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => enqueue(p.id)}>
                      Add to queue
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QueueCard({
  mode,
  onModeChange,
  orderedQueue,
  roster,
  nextMatch,
  dequeueForMatch
}: {
  mode: "Singles" | "Doubles";
  onModeChange: (m: "Singles" | "Doubles") => void;
  orderedQueue: (QueueEntry & { player: Player })[];
  roster: Player[];
  nextMatch: (QueueEntry & { player: Player })[];
  dequeueForMatch: () => void;
}) {
  const needed = mode === "Singles" ? 2 : 4;
  const hasNextMatch = nextMatch.length === needed;

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white fw-semibold py-2 d-flex justify-content-between align-items-center">
        <span>Queue (fair by games played)</span>
        <select
          className="form-select form-select-sm"
          style={{ width: 130 }}
          value={mode}
          onChange={(e) => onModeChange(e.target.value as any)}
        >
          <option>Singles</option>
          <option>Doubles</option>
        </select>
      </div>
      <div className="card-body">
        <div className="small text-muted mb-2">
          Players with fewer games bubble up. Ties resolved by join time.
        </div>

        <ul className="list-group mb-3">
          {orderedQueue.length === 0 && (
            <li className="list-group-item small text-muted">
              Queue is empty — add players from the roster.
            </li>
          )}
          {orderedQueue.map((q, idx) => (
            <li key={q.playerId + "-" + q.joinedAt} className="list-group-item d-flex justify-content-between">
              <div>
                <strong>#{idx + 1}</strong> {q.player.name}
              </div>
              <span className="text-muted small">{q.player.games} games played</span>
            </li>
          ))}
        </ul>

        <div className="border rounded p-3 bg-light">
          <div className="d-flex justify-content-between mb-2">
            <div className="fw-semibold">Next match</div>
            <span className="text-muted small">{needed} needed</span>
          </div>
          {hasNextMatch ? (
            <div className="small">
              {mode === "Singles" ? (
                <div className="d-flex justify-content-between">
                  <span>{nextMatch[0].player.name}</span>
                  <span className="text-muted">vs</span>
                  <span>{nextMatch[1].player.name}</span>
                </div>
              ) : (
                <div className="row g-2">
                  <div className="col-6">
                    <div className="p-2 bg-white rounded border">
                      <div className="fw-semibold small mb-1">Team A</div>
                      <div className="small">{nextMatch[0].player.name}</div>
                      <div className="small">{nextMatch[1].player.name}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2 bg-white rounded border">
                      <div className="fw-semibold small mb-1">Team B</div>
                      <div className="small">{nextMatch[2].player.name}</div>
                      <div className="small">{nextMatch[3].player.name}</div>
                    </div>
                  </div>
                </div>
              )}
              <button className="btn btn-dark btn-sm w-100 mt-3" onClick={dequeueForMatch}>
                Start match and advance queue
              </button>
            </div>
          ) : (
            <div className="text-muted small">Waiting for more players.</div>
          )}
        </div>
      </div>
    </div>
  );
}
