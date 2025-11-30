import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { RequireAuth, RequireQM } from "./components/Guard";

// pages
import Login from "./pages/Login";
import Logout from "./pages/Logout";
import Courts from "./pages/Courts";
import Queue from "./pages/Queue";
import QMDashboard from "./pages/QMDashboard";
import QueueManager from "./pages/QueueManager";
import Sessions from "./pages/Sessions";
import History from "./pages/History";

export default function App() {
  return (
    <BrowserRouter>
      <header
        style={{
          padding: 18,
          borderBottom: "1px solid #e8ecef",
          display: "flex",
          gap: 16,
          alignItems: "center",
          background: "linear-gradient(90deg, #0ea5e9, #4ade80)",
          color: "white",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontWeight: 700 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "white",
              display: "inline-block",
              boxShadow: "0 0 0 4px rgba(255,255,255,0.2)"
            }}
          />
          Badminton Queue
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="topnav" to="/">Courts</Link>
          <Link className="topnav" to="/sessions">Sessions</Link>
          <Link className="topnav" to="/queue-manager">Queue Manager</Link>
          <Link className="topnav" to="/history">History</Link>
          <Link className="topnav" to="/logout">Logout</Link>
        </nav>

        <div style={{ marginLeft: "auto", opacity: 0.9, fontSize: 14 }}>
          Web MVP
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
            path="/queue-manager"
            element={
              <RequireAuth>
                <QueueManager />
              </RequireAuth>
            }
          />
          <Route
            path="/queue-manager/:sessionId"
            element={
              <RequireAuth>
                <QueueManager />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <History />
              </RequireAuth>
            }
          />
          <Route
            path="/sessions"
            element={
              <RequireAuth>
                <Sessions />
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
          <Route 
            path="/logout"
            element={
              <RequireAuth>
                <Logout />
              </RequireAuth>
            }
          />
          {/* fallback */}
          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
