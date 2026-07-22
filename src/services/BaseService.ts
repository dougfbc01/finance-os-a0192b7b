// BaseService
// Classe base a ser herdada pelos demais Services do sistema.
// Fornece acesso compartilhado ao client Supabase e utilitários comuns
// (tratamento de erro e escopo por workspace). Sem regra de negócio.

import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UUID } from "@/models";

export abstract class BaseService {
  protected readonly client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Padroniza o tratamento de erros vindos do Supabase / camada de dados.
   * Serviços concretos podem sobrescrever conforme necessidade.
   */
  protected handleError(error: unknown, context?: string): never {
    const prefix = context ? `[${this.constructor.name}:${context}]` : `[${this.constructor.name}]`;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${prefix} ${message}`);
  }

  /**
   * Helper para queries escopadas por workspace. Não executa nada por si só;
   * apenas centraliza a convenção usada nas sprints futuras.
   */
  protected scopedBy(workspaceId: UUID) {
    return { workspace_id: workspaceId };
  }
}
