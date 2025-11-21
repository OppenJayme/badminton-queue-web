import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { tokenAtom } from "../state/auth";
import { finishMatch, getCourts, getLocations, getQueue, startMatch } from "../api/client";

type LastMatchMap = Record<string, number | null>;

export default function QMDashboard() {
  const token = useAtomValue(tokenAtom)!;
  const [locs, setLocs] = useState<any[]>([]);
  const [locId, setLocId] = useState<number | "">("");
  const [courts, setCourts] = useState<any[]>([]);
  const [mode, setMode] = useState<"Singles" | "Doubles">("Singles");
  const [lastMatchByCourt, setLastMatchByCourt] = useState<LastMatchMap>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getLocations(token).then(setLocs).catch((e) => setErr(e.message || "Could not load locations"));
  }, [token]);

  useEffect(() => {
    if (locId) {
      getCourts(Number(locId), token).then(setCourts).catch((e) => setErr(e.message || "Could not load courts"));
    } else {
      setCourts([]);
    }
  }, [locId, token]);

  const courtKey = useMemo(
    () => (courtId: number) => `${courtId}-${mode}`,
    [mode]
  );

  async function handleStart(courtId: number, courtName: string) {
    try {
      setErr(null);
      const q = await getQueue(courtId, mode, token);
      const needed = mode === "Singles" ? 2 : 4;
      if (q.entries.length < needed) {
        setErr("Not enough players in queue to start a match.");
        return;
      }
      const res = await startMatch(courtId, mode, token);
      setLastMatchByCourt((prev) => ({ ...prev, [courtKey(courtId)]: res.matchId }));
      alert(`Match started on Court ${courtName} (id ${res.matchId}) with: ${res.players}`);
    } catch (e: any) {
      setErr(e.message || "Failed to start match");
    }
  }

  async function handleFinish(courtId: number) {
    const key = courtKey(courtId);
    const matchId = lastMatchByCourt[key];
    if (!matchId) return;
    try {
      setErr(null);
      await finishMatch(matchId, "21-15, 21-17", token);
      alert(`Match ${matchId} finished`);
      setLastMatchByCourt((prev) => ({ ...prev, [key]: null }));
    } catch (e: any) {
      setErr(e.message || "Failed to finish match");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 className="mb-3">QueueMaster</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select value={locId} onChange={e => setLocId(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">-- select location --</option>
          {locs.map(l => <option key={l.id} value={l.id}>{l.city} - {l.name}</option>)}
        </select>
        <select value={mode} onChange={e => setMode(e.target.value as any)}>
          <option>Singles</option>
          <option>Doubles</option>
        </select>
      </div>

      {err && <div className="alert alert-danger py-2">{err}</div>}

      <ul style={{ marginTop: 12, paddingLeft: 18 }}>
        {courts.map(c => {
          const key = courtKey(c.id);
          const lastMatchId = lastMatchByCourt[key];
          return (
            <li key={c.id} style={{ marginBottom: 10 }}>
              <b>Court #{c.courtNumber}</b>
              <span className="text-muted"> {c.name ? `- ${c.name}` : ""}</span>
              <button style={{ marginLeft: 8 }} onClick={() => handleStart(c.id, c.courtNumber)}>
                Start match
              </button>

              <button
                style={{ marginLeft: 8 }}
                disabled={!lastMatchId}
                onClick={() => handleFinish(c.id)}
              >
                {lastMatchId ? `Finish match ${lastMatchId}` : "Finish last match"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
