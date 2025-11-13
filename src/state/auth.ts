import { atom } from "jotai";

export const tokenAtom = atom<string | null>(null);
export const roleAtom = atom<"Admin"|"QueueMaster"|"Player"|null>(null);
export const nameAtom = atom<string>("");

export const isQMOrAdminAtom = atom(get => {
  const r = get(roleAtom);
  return r === "QueueMaster" || r === "Admin";
});
