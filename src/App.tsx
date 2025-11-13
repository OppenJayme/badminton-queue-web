import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { RequireAuth, RequireQM } from "./components/Guard";

// pages
import Login from "./pages/Login";
import Courts from "./pages/Courts";
import Queue from "./pages/Queue";
import QMDashboard from "./pages/QMDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <header style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", gap: 12 }}>
        <Link to="/">Courts</Link>
        <Link to="/qm">QM</Link>
        <div style={{ marginLeft: "auto", opacity: 0.6 }}>
          Badminton Queue (Web MVP)
        </div>
      </header>

      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Player routes */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <Courts />
              </RequireAuth>
            }
          />
          <Route
            path="/queue/:courtId"
            element={
              <RequireAuth>
                <Queue />
              </RequireAuth>
            }
          />

          {/* QueueMaster/Admin routes */}
          <Route
            path="/qm"
            element={
              <RequireQM>
                <QMDashboard />
              </RequireQM>
            }
          />

          {/* fallback */}
          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
