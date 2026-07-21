export type UUID = string;

export interface Workspace {
  id: UUID;
  owner_id: UUID;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Profile {
  id: UUID;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
