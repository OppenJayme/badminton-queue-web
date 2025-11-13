import { useState } from "react";
import { useSetAtom } from "jotai";
import { tokenAtom, roleAtom, nameAtom } from "../state/auth";
import { login } from "../api/client";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";


export default function Login() {
  const [email, setEmail] = useState("player@example.com");
  const [password, setPassword] = useState("Player123!");
  const [err, setErr] = useState<string | null>(null);
  const setToken = useSetAtom(tokenAtom);
  const setRole = useSetAtom(roleAtom);
  const setName = useSetAtom(nameAtom);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await login(email, password);
      setToken(res.token);
      setRole(res.role as any);
      setName(res.displayName);
      nav("/");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function continueAsGuest() {
    nav("/guest");
  }

  return (
    <div className="d-flex justify-content-center align-items-center bg-light vh-100">

      <div className="card shadow-sm p-4" style={{ maxWidth: 420, width: "100%", borderRadius: "16px" }}>
        
        {/* Logo */}
        <div
          className="mx-auto mb-3 d-flex justify-content-center align-items-center"
          style={{
            width: 70,
            height: 70,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 20%, #A5D6A7, #4CAF50)"
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "white",
              opacity: 0.9
            }}
          />
        </div>

        <h3 className="text-center fw-bold mb-1">Log in to your account</h3>
        <p className="text-center text-muted mb-3">
          Welcome back! Please enter your details.
        </p>

        <form onSubmit={submit}>
          <div className="mb-3 text-start">
            <label className="form-label fw-semibold">Email</label>
            <input
              className="form-control"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="mb-2 text-start">
            <label className="form-label fw-semibold">Password</label>
            <input
              className="form-control"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {err && <div className="text-danger small mb-2">{err}</div>}

          <button
            type="submit"
            className="btn w-100 text-white fw-semibold mb-3"
            style={{ backgroundColor: "#4CAF50" }}
          >
            Continue with Email
          </button>
        </form>

        {/* Separator */}
        <div className="d-flex align-items-center my-3">
          <div className="flex-grow-1 border-top"></div>
          <span className="px-3 text-muted small">OR</span>
          <div className="flex-grow-1 border-top"></div>
        </div>

        {/* Guest Button */}
        <button
          className="btn btn-outline-secondary w-100 mb-3"
          onClick={continueAsGuest}
        >
          Continue as Guest
        </button>

        {/* Test accounts */}
        <div className="text-muted small mb-2 text-start">
          Try QM: <strong>qm@example.com</strong> / <strong>Qm123!</strong><br />
          Admin: <strong>admin@example.com</strong> / <strong>Admin123!</strong>
        </div>

        <div className="text-center small text-muted">
          Don’t have an account?{" "}
          <a className="text-success fw-semibold" href="#">
            Ask staff to register
          </a>
        </div>

      </div>
    </div>
  );
}
