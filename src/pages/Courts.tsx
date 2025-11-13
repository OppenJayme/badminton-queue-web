import { useEffect, useState } from "react";
import { getLocations, getCourts } from "../api/client";
import { useAtomValue } from "jotai";
import { tokenAtom } from "../state/auth";
import { Link } from "react-router-dom";

export default function Courts() {
  const token = useAtomValue(tokenAtom)!;
  const [locs, setLocs] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [locId, setLocId] = useState<number | "">("");

  useEffect(() => {
    getLocations(token).then(setLocs).catch(console.error);
  }, [token]);

  useEffect(() => {
    if (locId !== "") {
      getCourts(Number(locId), token).then(setCourts).catch(console.error);
    } else {
      setCourts([]);
    }
  }, [locId, token]);

  return (
    <div className="container py-4">
      <div className="row align-items-start">
        {/* Left side: filter / selector */}
        <div className="col-lg-4 col-md-5 mb-4">
          <h2 className="fw-bold mb-1">Courts</h2>
          <p className="text-muted mb-3">
            Choose a location to view available courts and open their queues.
          </p>

          <div className="card shadow-sm border-0">
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Location</label>
                <select
                  className="form-select"
                  value={locId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLocId(value === "" ? "" : Number(value));
                  }}
                >
                  <option value="">-- select location --</option>
                  {locs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.city} — {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="small text-muted">
                Tip: Start by choosing the venue you&apos;re playing at. You can
                then open the specific court queue.
              </div>
            </div>
          </div>
        </div>

        {/* Right side: courts list */}
        <div className="col-lg-8 col-md-7">
          {locId === "" && (
            <div className="text-muted">
              Select a location on the left to see its courts.
            </div>
          )}

          {locId !== "" && courts.length === 0 && (
            <div className="text-muted">
              No courts found for this location yet.
            </div>
          )}

          {locId !== "" && courts.length > 0 && (
            <div className="row g-3">
              {courts.map((c) => (
                <div key={c.id} className="col-md-6">
                  <div className="card h-100 shadow-sm border-0">
                    <div className="card-body d-flex flex-column">
                      <h5 className="fw-bold mb-1">
                        Court #{c.courtNumber}
                        {c.name ? ` — ${c.name}` : ""}
                      </h5>
                      <p className="text-muted small mb-3">
                        Ideal for up to 4 players per game. Join the queue to
                        secure your slot.
                      </p>

                      <div className="mt-auto d-flex justify-content-between align-items-center">
                        <span className="badge bg-success-subtle text-success">
                          Open for play
                        </span>
                        <Link
                          to={`/queue/${c.id}`}
                          className="btn btn-sm text-white"
                          style={{ backgroundColor: "#4CAF50" }}
                        >
                          Open Queue
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
