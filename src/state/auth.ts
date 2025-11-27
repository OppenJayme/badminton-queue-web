import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// Persist auth across reloads. Storage gracefully falls back when unavailable.
export const tokenAtom = atomWithStorage<string | null>("bq_token", null);
export const roleAtom = atomWithStorage<"Admin" | "QueueMaster" | "Player" | null>("bq_role", null);
export const nameAtom = atomWithStorage<string>("bq_name", "");

export const isQMOrAdminAtom = atom((get) => {
  const r = get(roleAtom);
  return r === "QueueMaster" || r === "Admin";
});
