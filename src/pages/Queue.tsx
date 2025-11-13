import { useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { tokenAtom, roleAtom } from "../state/auth";
import { useEffect, useState } from "react";
import { getQueue, enqueueSelf, leaveSelf, setQueueStatus } from "../api/client";

export default function QueuePage() {
  const { courtId } = useParams();
  const token = useAtomValue(tokenAtom)!;
  const role  = useAtomValue(roleAtom);
  const [mode, setMode] = useState<"Singles"|"Doubles">("Singles");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string|null>(null);

  async function load() {
    try {
      const q = await getQueue(Number(courtId), mode, token);
      setData(q);
    } catch (e:any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, [courtId, mode]);

  return (
    <div style={{padding:16}}>
      <h2>Queue — Court {courtId}</h2>
      <div style={{display:"flex", gap:8}}>
        <select value={mode} onChange={e=>setMode(e.target.value as any)}>
          <option>Singles</option>
          <option>Doubles</option>
        </select>
        <button onClick={load}>Refresh</button>
        { (role==="QueueMaster" || role==="Admin") && (
          <>
            <button onClick={async()=>{ await setQueueStatus(Number(courtId!), mode, true, token); load();}}>Open</button>
            <button onClick={async()=>{ await setQueueStatus(Number(courtId!), mode, false, token); load();}}>Close</button>
          </>
        )}
      </div>

      {err && <div style={{color:"crimson"}}>{err}</div>}

      {data && (
        <>
          <p>Status: <b>{data.isOpen ? "OPEN" : "CLOSED"}</b> · Mode: <b>{data.mode}</b></p>
          <div>
            <button disabled={!data.isOpen} onClick={async()=>{ await enqueueSelf(Number(courtId!), mode, token); load();}}>
              Join queue
            </button>
            <button onClick={async()=>{ await leaveSelf(Number(courtId!), mode, token); load();}}>
              Leave queue
            </button>
          </div>
          <ol>
            {data.entries?.map((e:any)=>(
              <li key={e.id}>#{e.position} — {(e.userId ?? `guest:${e.guestSessionId}`)}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
