// MarketQuoteScheduleService — Sprint 4.12
// Controle de frequência das cotações de mercado:
//  - Atualização AUTOMÁTICA: no máximo 1 vez por dia por workspace.
//  - Atualização MANUAL ("Atualizar cotações"): cooldown de 30 minutos após
//    uma atualização bem-sucedida, para evitar consumo acidental da cota.
// A política é pura e testável; a persistência (por workspace) usa
// localStorage — é apenas um carimbo de frequência, não um cache de cotações.

export const MANUAL_COOLDOWN_MS = 30 * 60 * 1000;

export interface QuoteScheduleState {
  /** Data local (YYYY-MM-DD) da última atualização automática bem-sucedida. */
  lastAutoDate: string | null;
  /** Epoch ms da última atualização (auto ou manual) bem-sucedida. */
  lastSuccessAt: number | null;
  /** Epoch ms até quando a atualização manual fica bloqueada. */
  manualCooldownUntil: number | null;
}

export const EMPTY_SCHEDULE: QuoteScheduleState = {
  lastAutoDate: null,
  lastSuccessAt: null,
  manualCooldownUntil: null,
};

export interface ManualUpdateCheck {
  allowed: boolean;
  /** Quando bloqueado, epoch ms em que a próxima consulta manual libera. */
  nextAllowedAt: number | null;
}

function localDateKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

class MarketQuoteScheduleServiceImpl {
  /** A atualização automática do dia ainda não aconteceu? */
  canAutoUpdate(state: QuoteScheduleState, now: Date = new Date()): boolean {
    return state.lastAutoDate !== localDateKey(now);
  }

  /** Registra uma atualização automática bem-sucedida. */
  markAutoUpdate(state: QuoteScheduleState, now: Date = new Date()): QuoteScheduleState {
    return {
      ...state,
      lastAutoDate: localDateKey(now),
      lastSuccessAt: now.getTime(),
    };
  }

  /** A atualização manual está liberada ou em cooldown? */
  checkManualUpdate(state: QuoteScheduleState, now: Date = new Date()): ManualUpdateCheck {
    const until = state.manualCooldownUntil;
    if (until !== null && now.getTime() < until) {
      return { allowed: false, nextAllowedAt: until };
    }
    return { allowed: true, nextAllowedAt: null };
  }

  /** Registra uma atualização manual bem-sucedida (inicia o cooldown). */
  markManualUpdate(state: QuoteScheduleState, now: Date = new Date()): QuoteScheduleState {
    return {
      lastAutoDate: localDateKey(now),
      lastSuccessAt: now.getTime(),
      manualCooldownUntil: now.getTime() + MANUAL_COOLDOWN_MS,
    };
  }

  /**
   * Próxima atualização automática previsível:
   *  - se a de hoje ainda não ocorreu, é hoje (na próxima carga da tela);
   *  - se já ocorreu, é amanhã.
   * Retorna null quando não há como determinar (nunca houve atualização).
   */
  nextAutoUpdateDate(state: QuoteScheduleState, now: Date = new Date()): Date | null {
    if (state.lastAutoDate === null) return null;
    if (this.canAutoUpdate(state, now)) return now;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }
}

export const MarketQuoteScheduleService = new MarketQuoteScheduleServiceImpl();
export { MarketQuoteScheduleServiceImpl };

// ---------------------------------------------------------------------------
// Persistência por workspace (localStorage). Isolada para ser testável.
// ---------------------------------------------------------------------------

const storageKey = (workspaceId: string) => `financeos:quote-schedule:${workspaceId}`;

export function loadQuoteSchedule(workspaceId: string): QuoteScheduleState {
  if (typeof window === "undefined") return EMPTY_SCHEDULE;
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (!raw) return EMPTY_SCHEDULE;
    const parsed = JSON.parse(raw) as Partial<QuoteScheduleState>;
    return {
      lastAutoDate: typeof parsed.lastAutoDate === "string" ? parsed.lastAutoDate : null,
      lastSuccessAt: typeof parsed.lastSuccessAt === "number" ? parsed.lastSuccessAt : null,
      manualCooldownUntil:
        typeof parsed.manualCooldownUntil === "number" ? parsed.manualCooldownUntil : null,
    };
  } catch {
    return EMPTY_SCHEDULE;
  }
}

export function saveQuoteSchedule(workspaceId: string, state: QuoteScheduleState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(state));
  } catch {
    // Sem storage disponível: a política simplesmente não persiste.
  }
}
