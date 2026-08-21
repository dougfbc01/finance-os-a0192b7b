// Sprint 4.9 — Módulo Administrativo, controle de acesso e auditoria.
// O fake client abaixo simula o comportamento do banco com RLS:
// um usuário comum simplesmente NÃO enxerga linhas de outros usuários.
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AdminServiceImpl } from "@/services/AdminService";
import type { AdminUserRow } from "@/models/Admin";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_ID = "33333333-3333-3333-3333-333333333333";

interface Row {
  [key: string]: unknown;
}

interface Db {
  profiles: Row[];
  user_access: Row[];
  user_roles: Row[];
  workspaces: Row[];
  subscriptions: Row[];
  admin_audit_logs: Row[];
  movements: Row[];
}

function seed(): Db {
  return {
    profiles: [
      { id: ADMIN_ID, name: "Admin", email: "admin@financeos.app", created_at: "2026-01-01T00:00:00Z" },
      { id: USER_ID, name: "Maria Souza", email: "maria@example.com", created_at: "2026-02-01T00:00:00Z" },
      { id: OTHER_ID, name: "João Lima", email: "joao@example.com", created_at: "2026-03-01T00:00:00Z" },
    ],
    user_access: [
      { user_id: ADMIN_ID, status: "ACTIVE", granted_at: "2026-01-01T00:00:00Z", blocked_at: null },
      { user_id: USER_ID, status: "ACTIVE", granted_at: "2026-02-02T00:00:00Z", blocked_at: null },
    ],
    user_roles: [{ user_id: ADMIN_ID, role: "admin" }],
    workspaces: [
      { id: "ws-1", name: "Meu Workspace", owner_id: USER_ID, deleted_at: null },
    ],
    subscriptions: [],
    admin_audit_logs: [],
    movements: [{ id: "m1", workspace_id: "ws-1", amount: 1000, description: "Salário" }],
  };
}

/** Simula RLS: sem papel admin, o "servidor" devolve apenas as linhas do próprio usuário. */
function makeClient(db: Db, currentUser: string) {
  const isAdmin = db.user_roles.some((r) => r['user_id'] === currentUser && r['role'] === "admin");

  const visible = (table: keyof Db): Row[] => {
    const rows = db[table];
    if (isAdmin && table !== "movements") return rows;
    switch (table) {
      case "profiles":
        return rows.filter((r) => r['id'] === currentUser);
      case "user_access":
      case "user_roles":
      case "subscriptions":
        return rows.filter((r) => r['user_id'] === currentUser);
      case "workspaces":
        return rows.filter((r) => r['owner_id'] === currentUser);
      case "admin_audit_logs":
        return isAdmin ? rows : [];
      case "movements":
        // Dados financeiros nunca são liberados por papel administrativo.
        return rows.filter((r) =>
          db.workspaces.some((w) => w['id'] === r['workspace_id'] && w['owner_id'] === currentUser),
        );
      default:
        return [];
    }
  };

  function builder(table: keyof Db) {
    let rows = visible(table);
    const api = {
      select: () => api,
      is: () => api,
      order: () => api,
      limit: () => api,
      eq: (col: string, value: unknown) => {
        rows = rows.filter((r) => r[col] === value);
        return api;
      },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      insert: async (payload: Row) => {
        if (table === "admin_audit_logs" && !isAdmin) {
          return { data: null, error: { message: "permission denied" } };
        }
        db[table].push({ id: `log-${db[table].length + 1}`, created_at: new Date().toISOString(), ...payload });
        return { data: null, error: null };
      },
      upsert: async (payload: Row) => {
        if (!isAdmin) return { data: null, error: { message: "permission denied" } };
        const key = table === "user_access" ? "user_id" : "user_id";
        const existing = db[table].find((r) => r[key] === payload[key]);
        if (existing) Object.assign(existing, payload);
        else db[table].push({ ...payload });
        return { data: null, error: null };
      },
      delete: () => {
        const del = {
          eq: (col: string, value: unknown) => {
            db[table] = db[table].filter((r) => r[col] !== value) as Row[];
            return del;
          },
          then: undefined,
        };
        return Object.assign(Promise.resolve({ data: null, error: null }), del);
      },
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
        resolve({ data: rows, error: null }),
    };
    return api;
  }

  return { from: (table: string) => builder(table as keyof Db) } as unknown as SupabaseClient;
}

function service(db: Db, currentUser: string) {
  return new AdminServiceImpl(makeClient(db, currentUser));
}

describe("Sprint 4.9 — autorização administrativa", () => {
  it("1. usuário comum não é reconhecido como administrador", async () => {
    const db = seed();
    await expect(service(db, USER_ID).isAdmin(USER_ID)).resolves.toBe(false);
  });

  it("2. administrador é reconhecido como administrador", async () => {
    const db = seed();
    await expect(service(db, ADMIN_ID).isAdmin(ADMIN_ID)).resolves.toBe(true);
  });

  it("3. administrador lista todos os usuários", async () => {
    const db = seed();
    const rows = await service(db, ADMIN_ID).listUsers();
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.email)).toContain("maria@example.com");
  });

  it("3b. usuário comum não recebe dados de outros usuários", async () => {
    const db = seed();
    const rows = await service(db, USER_ID).listUsers();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(USER_ID);
  });

  it("usuário sem registro de acesso é tratado como PENDING", async () => {
    const db = seed();
    const rows = await service(db, ADMIN_ID).listUsers();
    expect(rows.find((r) => r.id === OTHER_ID)?.status).toBe("PENDING");
  });
});

describe("Sprint 4.9 — liberação e bloqueio", () => {
  it("4. usuário pode ser liberado", async () => {
    const db = seed();
    await service(db, ADMIN_ID).grantAccess(ADMIN_ID, OTHER_ID);
    const row = db.user_access.find((r) => r['user_id'] === OTHER_ID);
    expect(row?.['status']).toBe("ACTIVE");
    expect(row?.['granted_at']).toBeTruthy();
  });

  it("5. usuário pode ser bloqueado", async () => {
    const db = seed();
    await service(db, ADMIN_ID).blockAccess(ADMIN_ID, USER_ID, "inadimplência");
    const row = db.user_access.find((r) => r['user_id'] === USER_ID);
    expect(row?.['status']).toBe("BLOCKED");
    expect(row?.['blocked_at']).toBeTruthy();
  });

  it("5b. usuário comum não consegue alterar o próprio status", async () => {
    const db = seed();
    await expect(service(db, USER_ID).grantAccess(USER_ID, USER_ID)).rejects.toThrow();
    expect(db.user_access.find((r) => r['user_id'] === USER_ID)?.['status']).toBe("ACTIVE");
  });

  it("6. usuário bloqueado não pode utilizar áreas protegidas", () => {
    const svc = new AdminServiceImpl();
    expect(svc.canUseApp("BLOCKED")).toBe(false);
    expect(svc.canUseApp("PENDING")).toBe(false);
    expect(svc.canUseApp("ACTIVE")).toBe(true);
    expect(svc.canUseApp(null)).toBe(false);
  });

  it("7. bloqueio não exclui dados do usuário", async () => {
    const db = seed();
    await service(db, ADMIN_ID).blockAccess(ADMIN_ID, USER_ID);
    expect(db.profiles.some((p) => p['id'] === USER_ID)).toBe(true);
    expect(db.workspaces.some((w) => w['owner_id'] === USER_ID)).toBe(true);
    expect(db.movements).toHaveLength(1);
  });
});

describe("Sprint 4.9 — auditoria", () => {
  it("8. auditoria registra a ação administrativa", async () => {
    const db = seed();
    await service(db, ADMIN_ID).blockAccess(ADMIN_ID, USER_ID, "teste");
    expect(db.admin_audit_logs).toHaveLength(1);
    const log = db.admin_audit_logs[0]!;
    expect(log['action']).toBe("USER_ACCESS_BLOCKED");
    expect(log['actor_id']).toBe(ADMIN_ID);
    expect(log['target_user_id']).toBe(USER_ID);
  });

  it("8b. auditoria não é legível por usuário comum", async () => {
    const db = seed();
    await service(db, ADMIN_ID).grantAccess(ADMIN_ID, OTHER_ID);
    await expect(service(db, USER_ID).listAudit()).resolves.toHaveLength(0);
    await expect(service(db, ADMIN_ID).listAudit()).resolves.toHaveLength(1);
  });

  it("8c. alteração de permissão administrativa é auditada", async () => {
    const db = seed();
    await service(db, ADMIN_ID).setAdminRole(ADMIN_ID, USER_ID, true);
    expect(db.user_roles.some((r) => r['user_id'] === USER_ID && r['role'] === "admin")).toBe(true);
    expect(db.admin_audit_logs[0]?.['action']).toBe("ADMIN_ROLE_GRANTED");
  });
});

describe("Sprint 4.9 — dados financeiros e filtros", () => {
  it("9. papel administrativo não expõe movimentações de outros usuários", async () => {
    const db = seed();
    const client = makeClient(db, ADMIN_ID);
    const { data } = (await client.from("movements").select("*")) as { data: unknown[] };
    expect(data).toHaveLength(0);
  });

  it("10. filtros por status e busca funcionam", async () => {
    const db = seed();
    const svc = service(db, ADMIN_ID);
    const rows = await svc.listUsers();

    expect(svc.filterUsers(rows, { status: "ACTIVE" }).map((r) => r.id).sort()).toEqual(
      [ADMIN_ID, USER_ID].sort(),
    );
    expect(svc.filterUsers(rows, { status: "PENDING" })).toHaveLength(1);
    expect(svc.filterUsers(rows, { search: "maria@" })).toHaveLength(1);
    expect(svc.filterUsers(rows, { search: "JOÃO" })).toHaveLength(1);
    expect(svc.filterUsers(rows, { search: "joão" })).toHaveLength(1);
    expect(svc.filterUsers(rows, { search: "  " })).toHaveLength(3);
  });

  it("indicadores usam apenas dados reais", async () => {
    const db = seed();
    const svc = service(db, ADMIN_ID);
    const rows = await svc.listUsers();
    const overview = svc.overview(rows, new Date("2026-08-19T00:00:00Z"));

    expect(overview.totalUsers).toBe(3);
    expect(overview.active).toBe(2);
    expect(overview.pending).toBe(1);
    expect(overview.blocked).toBe(0);
    expect(overview.admins).toBe(1);
    expect(overview.subscriptionsActive).toBe(0);
    expect(overview.trials).toBe(0);
    expect(overview.expiringSoon).toBe(0);
  });

  it("indicadores de assinatura contam trials e vencimentos próximos", () => {
    const svc = new AdminServiceImpl();
    const base: AdminUserRow = {
      id: USER_ID,
      name: "Maria",
      email: "maria@example.com",
      created_at: "2026-02-01T00:00:00Z",
      last_sign_in_at: null,
      status: "ACTIVE",
      granted_at: null,
      blocked_at: null,
      is_admin: false,
      workspaces: [],
      subscription: {
        id: "s1",
        user_id: USER_ID,
        plan: "PRO",
        status: "TRIALING",
        started_at: null,
        current_period_start: null,
        current_period_end: "2026-08-25T00:00:00Z",
        trial_ends_at: "2026-08-25T00:00:00Z",
        canceled_at: null,
        notes: null,
      },
    };
    const overview = svc.overview([base], new Date("2026-08-19T00:00:00Z"));
    expect(overview.trials).toBe(1);
    expect(overview.expiringSoon).toBe(1);
  });
});
