// BaseService
// Classe base a ser herdada pelos demais Services do sistema.
// Fornece acesso compartilhado ao client Supabase e utilitários comuns
// (tratamento de erro e escopo por workspace). Sem regra de negócio.

import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "@/models";

/** Readable message for Error instances, Supabase/PostgREST error objects and primitives. */
export function describeError(error: unknown): string {
  if (error instanceof Error && !("code" in error || "details" in error || "hint" in error)) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const str = (v: unknown) => (typeof v === "string" || typeof v === "number") && String(v).trim() ? String(v).trim() : null;
    const parts = [str(e.message) ?? "Erro desconhecido"];
    const code = str(e.code), details = str(e.details), hint = str(e.hint);
    if (code) parts.push(`(código ${code})`);
    if (details) parts.push(`— detalhes: ${details}`);
    if (hint) parts.push(`— dica: ${hint}`);
    if (!str(e.message) && !code && !details && !hint) {
      try { return JSON.stringify(error); } catch { return "Erro desconhecido"; }
    }
    return parts.join(" ");
  }
  return String(error);
}

export abstract class BaseService {
  protected readonly client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /** Explicit service name (constructor.name is minified in production builds). */
  protected abstract readonly serviceName: string;

  /**
   * Padroniza o tratamento de erros vindos do Supabase / camada de dados.
   * Erros do PostgREST são objetos simples ({ message, code, details, hint }).
   */
  protected handleError(error: unknown, context?: string): never {
    const prefix = context ? `[${this.serviceName}:${context}]` : `[${this.serviceName}]`;
    throw new Error(`${prefix} ${describeError(error)}`);
  }

  /**
   * Helper para queries escopadas por workspace. Não executa nada por si só;
   * apenas centraliza a convenção usada nas sprints futuras.
   */
  protected scopedBy(workspaceId: UUID) {
    return { workspace_id: workspaceId };
  }
}
