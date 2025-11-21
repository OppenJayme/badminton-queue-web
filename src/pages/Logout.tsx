// src/pages/Logout.tsx
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { tokenAtom, roleAtom, nameAtom } from "../state/auth";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const setToken = useSetAtom(tokenAtom);
  const setRole = useSetAtom(roleAtom);
  const setName = useSetAtom(nameAtom);
  const navigate = useNavigate();

  useEffect(() => {
    setToken(null);
    setRole(null);
    setName("");
    navigate("/login", { replace: true });
  }, [setToken, setRole, setName, navigate]);

  return <p>Signing out...</p>;
}
