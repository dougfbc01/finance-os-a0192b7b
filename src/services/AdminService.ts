// AdminService — Módulo Administrativo (Sprint 4.9).
// ESCOPO: identidade, liberação de acesso, papéis, auditoria e preparação de assinatura.
// NÃO acessa nem expõe dados financeiros de outros usuários.
//
// SEGURANÇA:
//  • A autorização real é do banco (RLS + public.has_role). O frontend apenas
//    reflete o que o servidor já autorizou — nada aqui concede permissão.
//  • Um usuário comum que chamar estes métodos recebe listas vazias / erro de RLS.
import { BaseService } from "./BaseService";
import type { UUID } from "@/models";
import type {
  AdminAuditLog,
  AdminOverview,
  AdminUserFilters,
  AdminUserRow,
  AdminWorkspaceRef,
  Subscription,
  UserAccess,
  UserAccessStatus,
} from "@/models/Admin";

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
}

export interface BuildUserRowsInput {
  profiles: ProfileRow[];
  access: Pick<UserAccess, "user_id" | "status" | "granted_at" | "blocked_at">[];
  roles: { user_id: string; role: string }[];
  workspaces: WorkspaceRow[];
  subscriptions: Subscription[];
}

/** Dias considerados para "assinaturas vencendo" nos indicadores SaaS. */
export const EXPIRING_SOON_DAYS = 15;

export class AdminServiceImpl extends BaseService {
  // ---------------------------------------------------------------- lógica pura

  /** Junta identidade + acesso + papéis + workspaces em linhas de tabela. */
  buildUserRows(input: BuildUserRowsInput): AdminUserRow[] {
    const accessByUser = new Map(input.access.map((a) => [a.user_id, a]));
    const adminIds = new Set(
      input.roles.filter((r) => r.role === "admin").map((r) => r.user_id),
    );
    const wsByOwner = new Map<string, AdminWorkspaceRef[]>();
    for (const ws of input.workspaces) {
      const list = wsByOwner.get(ws.owner_id) ?? [];
      list.push({ id: ws.id, name: ws.name });
      wsByOwner.set(ws.owner_id, list);
    }
    const subByUser = new Map(input.subscriptions.map((s) => [s.user_id, s]));

    return input.profiles.map((p) => {
      const access = accessByUser.get(p.id);
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        created_at: p.created_at,
        last_sign_in_at: null,
        status: (access?.status ?? "PENDING") as UserAccessStatus,
        granted_at: access?.granted_at ?? null,
        blocked_at: access?.blocked_at ?? null,
        is_admin: adminIds.has(p.id),
        workspaces: wsByOwner.get(p.id) ?? [],
        subscription: subByUser.get(p.id) ?? null,
      };
    });
  }

  /** Busca (nome/e-mail) + filtro por status. */
  filterUsers(rows: AdminUserRow[], filters: AdminUserFilters): AdminUserRow[] {
    const term = (filters.search ?? "").trim().toLowerCase();
    const status = filters.status ?? "ALL";
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (!term) return true;
      const haystack = `${r.name ?? ""} ${r.email ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  /** Indicadores SaaS — apenas dados reais existentes. */
  overview(rows: AdminUserRow[], reference: Date = new Date()): AdminOverview {
    const limit = new Date(reference);
    limit.setDate(limit.getDate() + EXPIRING_SOON_DAYS);

    let active = 0;
    let blocked = 0;
    let pending = 0;
    let admins = 0;
    let subscriptionsActive = 0;
    let trials = 0;
    let canceled = 0;
    let expiringSoon = 0;

    for (const r of rows) {
      if (r.status === "ACTIVE") active += 1;
      if (r.status === "BLOCKED") blocked += 1;
      if (r.status === "PENDING") pending += 1;
      if (r.is_admin) admins += 1;

      const sub = r.subscription;
      if (!sub) continue;
      if (sub.status === "ACTIVE") subscriptionsActive += 1;
      if (sub.status === "TRIALING") trials += 1;
      if (sub.status === "CANCELED") canceled += 1;
      if (sub.current_period_end) {
        const end = new Date(sub.current_period_end);
        if (end >= reference && end <= limit) expiringSoon += 1;
      }
    }

    return {
      totalUsers: rows.length,
      active,
      blocked,
      pending,
      admins,
      subscriptionsActive,
      trials,
      canceled,
      expiringSoon,
    };
  }

  /** Regra de uso do sistema: somente ACTIVE utiliza áreas protegidas. */
  canUseApp(status: UserAccessStatus | null | undefined): boolean {
    return status === "ACTIVE";
  }

  // ---------------------------------------------------------------- acesso a dados

  async isAdmin(userId: UUID): Promise<boolean> {
    const { data, error } = await this.client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) this.handleError(error, "isAdmin");
    return !!data;
  }

  /** Status de acesso do próprio usuário (RLS permite ler apenas o seu). */
  async myAccess(userId: UUID): Promise<UserAccess | null> {
    const { data, error } = await this.client
      .from("user_access")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) this.handleError(error, "myAccess");
    return (data as UserAccess | null) ?? null;
  }

  async listUsers(): Promise<AdminUserRow[]> {
    const [profiles, access, roles, workspaces, subscriptions] = await Promise.all([
      this.client.from("profiles").select("id, name, email, created_at"),
      this.client.from("user_access").select("user_id, status, granted_at, blocked_at"),
      this.client.from("user_roles").select("user_id, role"),
      this.client.from("workspaces").select("id, name, owner_id").is("deleted_at", null),
      this.client.from("subscriptions").select("*"),
    ]);

    const err =
      profiles.error ?? access.error ?? roles.error ?? workspaces.error ?? subscriptions.error;
    if (err) this.handleError(err, "listUsers");

    return this.buildUserRows({
      profiles: (profiles.data ?? []) as ProfileRow[],
      access: (access.data ?? []) as UserAccess[],
      roles: (roles.data ?? []) as { user_id: string; role: string }[],
      workspaces: (workspaces.data ?? []) as WorkspaceRow[],
      subscriptions: (subscriptions.data ?? []) as Subscription[],
    }).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  private async setStatus(
    actorId: UUID,
    targetUserId: UUID,
    status: UserAccessStatus,
    reason?: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      user_id: targetUserId,
      status,
      reason: reason ?? null,
      updated_at: now,
    };
    if (status === "ACTIVE") payload['granted_at'] = now;
    if (status === "BLOCKED") payload['blocked_at'] = now;

    const { error } = await this.client
      .from("user_access")
      .upsert(payload, { onConflict: "user_id" });
    if (error) this.handleError(error, "setStatus");

    await this.logAction(
      actorId,
      targetUserId,
      status === "ACTIVE" ? "USER_ACCESS_GRANTED" : "USER_ACCESS_BLOCKED",
      { status, reason: reason ?? null },
    );
  }

  /** Libera o usuário. Não altera nenhum dado financeiro. */
  grantAccess(actorId: UUID, targetUserId: UUID, reason?: string) {
    return this.setStatus(actorId, targetUserId, "ACTIVE", reason);
  }

  /** Bloqueia o usuário — preserva integralmente dados e histórico. */
  blockAccess(actorId: UUID, targetUserId: UUID, reason?: string) {
    return this.setStatus(actorId, targetUserId, "BLOCKED", reason);
  }

  async setAdminRole(actorId: UUID, targetUserId: UUID, isAdmin: boolean): Promise<void> {
    if (isAdmin) {
      const { error } = await this.client
        .from("user_roles")
        .upsert({ user_id: targetUserId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) this.handleError(error, "setAdminRole");
    } else {
      const { error } = await this.client
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "admin");
      if (error) this.handleError(error, "setAdminRole");
    }
    await this.logAction(
      actorId,
      targetUserId,
      isAdmin ? "ADMIN_ROLE_GRANTED" : "ADMIN_ROLE_REVOKED",
      {},
    );
  }

  async logAction(
    actorId: UUID,
    targetUserId: UUID | null,
    action: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.client.from("admin_audit_logs").insert({
      actor_id: actorId,
      target_user_id: targetUserId,
      action,
      details,
    });
    if (error) this.handleError(error, "logAction");
  }

  async listAudit(limit = 50): Promise<AdminAuditLog[]> {
    const { data, error } = await this.client
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) this.handleError(error, "listAudit");
    return (data ?? []) as AdminAuditLog[];
  }
}

export const AdminService = new AdminServiceImpl();
