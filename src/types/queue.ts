export type Player = {
  id: number;
  displayName: string;
  gamesPlayed: number;
  isRegistered: boolean;
};

export type QueueEntry = {
  id: number;
  position: number;
  playerId: number;
  displayName: string;
  gamesPlayed: number;
  joinedAt: string;
};

export type QueueDetails = {
  id: number;
  name: string;
  mode: "Singles" | "Doubles";
  isOpen: boolean;
  entries: QueueEntry[];
};

export type OngoingMatch = {
  id: number;
  startedAt: string;
  players: { id: number; name: string }[];
};

export type MatchHistory = {
  id: number;
  status: string;
  mode: string;
  startTime?: string;
  finishTime?: string;
  scoreText?: string;
  players: { id: number; name: string }[];
};
