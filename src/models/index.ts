// Models: entidades de domínio persistidas (espelham as tabelas do backend).
// Diferente de src/types, que guarda tipos utilitários e de UI.

export type UUID = string;
export type ISODateString = string;

export interface Workspace {
  id: UUID;
  owner_id: UUID;
  name: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
}

export interface Profile {
  id: UUID;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
