export type SessionListItem = {
  id: number;
  name: string;
  description?: string;
  isPublic: boolean;
  ownerName: string;
  members: number;
  myStatus?: string | null;
  isMine: boolean;
};

export type SessionMember = {
  userId: number;
  name: string;
  status: string;
  role: string;
};

export type SessionDetail = {
  id: number;
  name: string;
  description?: string;
  isPublic: boolean;
  ownerUserId: number;
  ownerName: string;
  members: SessionMember[];
};
