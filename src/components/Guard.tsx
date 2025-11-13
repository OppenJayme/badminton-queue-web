// src/components/Guard.tsx
import { useAtomValue } from "jotai";
import { tokenAtom, isQMOrAdminAtom } from "../state/auth";
import { Navigate } from "react-router-dom";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAtomValue(tokenAtom);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export function RequireQM({ children }: { children: React.ReactNode }) {
  const token = useAtomValue(tokenAtom);
  const ok = useAtomValue(isQMOrAdminAtom);
  return token && ok ? <>{children}</> : <Navigate to="/" replace />;
}
