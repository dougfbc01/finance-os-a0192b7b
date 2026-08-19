// Models do módulo administrativo (Sprint 4.9).
// Escopo: IDENTIDADE, ACESSO e (preparação) ASSINATURA.
// Nunca contém dados financeiros de usuários.
import type { ISODateString, UUID } from "./index";

export type AppRole = "admin" | "user";

export type UserAccessStatus = "PENDING" | "ACTIVE" | "BLOCKED";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";

export interface UserAccess {
  user_id: UUID;
  status: UserAccessStatus;
  granted_at: ISODateString | null;
  blocked_at: ISODateString | null;
  reason: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

/** Preparação Bloco 4 — nenhum gateway de cobrança nesta sprint. */
export interface Subscription {
  id: UUID;
  user_id: UUID;
  plan: string;
  status: SubscriptionStatus;
  started_at: ISODateString | null;
  current_period_start: ISODateString | null;
  current_period_end: ISODateString | null;
  trial_ends_at: ISODateString | null;
  canceled_at: ISODateString | null;
  notes: string | null;
}

export interface AdminAuditLog {
  id: UUID;
  actor_id: UUID | null;
  target_user_id: UUID | null;
  action: string;
  details: Record<string, unknown>;
  created_at: ISODateString;
}

export interface AdminWorkspaceRef {
  id: UUID;
  name: string;
}

/** Linha da tabela de usuários da área administrativa. */
export interface AdminUserRow {
  id: UUID;
  name: string | null;
  email: string | null;
  created_at: ISODateString;
  /** Não disponível hoje (a base de identidade não é exposta ao app). */
  last_sign_in_at: ISODateString | null;
  status: UserAccessStatus;
  granted_at: ISODateString | null;
  blocked_at: ISODateString | null;
  is_admin: boolean;
  workspaces: AdminWorkspaceRef[];
  subscription: Subscription | null;
}

export interface AdminUserFilters {
  /** Busca por nome ou e-mail. */
  search?: string;
  status?: UserAccessStatus | "ALL";
}

export interface AdminOverview {
  totalUsers: number;
  active: number;
  blocked: number;
  pending: number;
  admins: number;
  /** Preparação SaaS — só conta o que existir de verdade. */
  subscriptionsActive: number;
  trials: number;
  canceled: number;
  expiringSoon: number;
}

export const ACCESS_STATUS_LABEL: Record<UserAccessStatus, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  BLOCKED: "Bloqueado",
};

export const ADMIN_ACTION_LABEL: Record<string, string> = {
  USER_ACCESS_GRANTED: "Acesso liberado",
  USER_ACCESS_BLOCKED: "Acesso bloqueado",
  ADMIN_ROLE_GRANTED: "Permissão de administrador concedida",
  ADMIN_ROLE_REVOKED: "Permissão de administrador removida",
};
