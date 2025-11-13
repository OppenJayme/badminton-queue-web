import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { tokenAtom } from "../state/auth";
import { getLocations, getCourts, startMatch, finishMatch, getQueue } from "../api/client";

export default function QMDashboard() {
  const token = useAtomValue(tokenAtom)!;
  const [locs, setLocs] = useState<any[]>([]);
  const [locId, setLocId] = useState<number|''>('');
  const [courts, setCourts] = useState<any[]>([]);
  const [mode, setMode] = useState<"Singles"|"Doubles">("Singles");
  const [lastMatchId, setLastMatchId] = useState<number| null>(null);

  useEffect(()=>{ getLocations(token).then(setLocs)}, [token]);
  useEffect(()=>{
    if (locId) getCourts(Number(locId), token).then(setCourts);
    else setCourts([]);
  }, [locId, token]);

  return (
    <div style={{padding:16}}>
      <h2>QueueMaster</h2>
      <div style={{display:"flex", gap:8}}>
        <select value={locId} onChange={e=>setLocId(Number(e.target.value))}>
          <option value="">-- select location --</option>
          {locs.map(l => <option key={l.id} value={l.id}>{l.city} — {l.name}</option>)}
        </select>
        <select value={mode} onChange={e=>setMode(e.target.value as any)}>
          <option>Singles</option>
          <option>Doubles</option>
        </select>
      </div>

      <ul style={{marginTop:12}}>
        {courts.map(c => (
          <li key={c.id} style={{marginBottom:8}}>
            <b>Court #{c.courtNumber}</b>
            <button style={{marginLeft:8}} onClick={async()=>{
              const q = await getQueue(c.id, mode, token);
              if ((mode==="Singles" && q.entries.length < 2) || (mode==="Doubles" && q.entries.length < 4)) {
                alert("Not enough players in queue");
                return;
              }
              const res = await startMatch(c.id, mode, token);
              setLastMatchId(res.matchId);
              alert(`Match started (id ${res.matchId}) with: ${res.players}`);
            }}>Start match</button>

            <button style={{marginLeft:8}} disabled={!lastMatchId} onClick={async()=>{
              if (!lastMatchId) return;
              await finishMatch(lastMatchId, "21-15, 21-17", token);
              alert(`Match ${lastMatchId} finished`);
              setLastMatchId(null);
            }}>Finish last match</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
