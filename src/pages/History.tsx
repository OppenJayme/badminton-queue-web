import { useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { tokenAtom } from "../state/auth";
import { getMatchHistory, getQueueDetails } from "../api/client";
import { queueCacheAtom, lastQueueIdAtom } from "../state/cache";
import type { MatchHistory } from "../types/queue";

type QueueOption = { id: number; name: string };

export default function History() {
  const token = useAtomValue(tokenAtom)!;
  const [queueCache] = useAtom(queueCacheAtom);
  const [lastQueueId] = useAtom(lastQueueIdAtom);
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [queueId, setQueueId] = useState<number | null>(lastQueueId);
  const [status, setStatus] = useState<string>("Finished");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [queueNameMap, setQueueNameMap] = useState<Record<number, string>>({});

  const options: QueueOption[] = useMemo(() => {
    const ids = new Set<number>();
    Object.values(queueCache).forEach((q) => ids.add(q.queue.id));
    if (lastQueueId) ids.add(lastQueueId);
    return Array.from(ids).map((id) => ({
      id,
      name: queueCache[id]?.queue.name || `Queue #${id}`
    }));
  }, [queueCache, lastQueueId]);

  useEffect(() => {
    // populate names from cache
    const map: Record<number, string> = {};
    Object.values(queueCache).forEach((q) => (map[q.queue.id] = q.queue.name));
    setQueueNameMap(map);
  }, [queueCache]);

  useEffect(() => {
    if (!queueId) return;
    load(queueId, status);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueId, status]);

  async function load(id: number, s: string) {
    setLoading(true);
    setErr(null);
    try {
      const res = await getMatchHistory(id, token, s);
      setMatches(res);
      if (!queueNameMap[id]) {
        // try to fetch name once
        const q = await getQueueDetails(id, token);
        setQueueNameMap((prev) => ({ ...prev, [id]: q.name || `Queue #${id}` }));
      }
    } catch (e: any) {
      setErr(e.message);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-0">History</h3>
          <div className="text-muted small">Recent matches for your queues.</div>
        </div>
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            value={queueId ?? ""}
            onChange={(e) => setQueueId(e.target.value ? Number(e.target.value) : null)}
            style={{ minWidth: 180 }}
          >
            <option value="">Select a queue</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name} (#{o.id})</option>
            ))}
          </select>
          <select
            className="form-select form-select-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="Finished">Finished</option>
            <option value="">All</option>
            <option value="Ongoing">Ongoing</option>
          </select>
          <button className="btn btn-outline-secondary btn-sm" disabled={loading || !queueId} onClick={() => queueId && load(queueId, status)}>
            {loading && <span className="spinner-border spinner-border-sm me-1" role="status" />}
            Refresh
          </button>
        </div>
      </div>

      {err && <div className="alert alert-danger py-2">{err}</div>}
      {!queueId && <div className="alert alert-secondary py-2">Choose a queue to view its history.</div>}

      <div className="list-group">
        {queueId && matches.map((m) => {
          const start = m.startTime ? new Date(m.startTime) : null;
          const finish = m.finishTime ? new Date(m.finishTime) : null;
          const duration = start && finish ? Math.max(0, Math.round((finish.getTime() - start.getTime()) / 60000)) : null;
          return (
            <div key={m.id} className="list-group-item">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div className="fw-semibold">Match #{m.id} · {m.mode}</div>
                  <div className="small text-muted">{m.players.map(p => p.name).join(" vs ")}</div>
                  {m.scoreText && <div className="small">{m.scoreText}</div>}
                  <div className="small text-muted">
                    {start ? `Started: ${start.toLocaleString()}` : ""}
                    {finish ? ` · Finished: ${finish.toLocaleString()}` : ""}
                    {duration !== null ? ` · Duration: ${duration} min` : ""}
                  </div>
                </div>
                <span className="badge bg-light text-muted">{m.status}</span>
              </div>
            </div>
          );
        })}
        {queueId && !loading && matches.length === 0 && (
          <div className="list-group-item text-muted small">No matches found.</div>
        )}
      </div>
    </div>
  );
}
