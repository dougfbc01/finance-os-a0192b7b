// ImportReviewService — Sprint 4.5.2
// Isola os lançamentos EFETIVAMENTE NOVOS de uma importação para revisão humana.
//
// Não cria motor de regras, deduplicação ou edição paralelos: apenas compõe
// ClassificationRuleService (explicação da classificação) e SimilarityService
// (alerta de possível duplicidade) sobre as movimentações que carregam o
// `import_id` daquela importação. Duplicados descartados nunca são persistidos,
// portanto nunca aparecem aqui.
import { BaseService } from "./BaseService";
import { ClassificationRuleServiceImpl } from "./ClassificationRuleService";
import { SimilarityServiceImpl, REVIEW_THRESHOLD } from "./SimilarityService";
import { MovementType } from "@/constants/enums";
import type { RuleSimulation } from "./ClassificationRuleService";
import type { ClassificationRule, Movement, UUID } from "@/models";
import type { ImportRecord } from "@/models/Import";

export type ImportReviewFlag =
  | "NO_CATEGORY"
  | "LOW_SPECIFICITY"
  | "AMBIGUOUS_RULE"
  | "POSSIBLE_DUPLICATE";

export const IMPORT_REVIEW_FLAG_LABELS: Record<ImportReviewFlag, string> = {
  NO_CATEGORY: "Sem categoria",
  LOW_SPECIFICITY: "Classificação de baixa especificidade",
  AMBIGUOUS_RULE: "Regras em conflito",
  POSSIBLE_DUPLICATE: "Possível duplicidade",
};

export interface ImportReviewRow {
  movement: Movement;
  /** Explicação da decisão do motor de regras (dry-run, nada é aplicado). */
  simulation: RuleSimulation | null;
  /** A categoria atual coincide com a que a regra vencedora indicaria. */
  autoClassified: boolean;
  duplicateOf: { movement: Movement; confidence: number; label: string } | null;
  flags: ImportReviewFlag[];
}

export interface ImportReviewSummary {
  total: number;
  autoClassified: number;
  withoutCategory: number;
  needsAttention: number;
  possibleDuplicates: number;
  income: number;
  expense: number;
  net: number;
}

export interface ImportReviewData {
  importRecord: ImportRecord;
  rows: ImportReviewRow[];
  summary: ImportReviewSummary;
}

/** Tipos cuja ausência de categoria é normal e não exige atenção. */
const CATEGORY_EXEMPT: MovementType[] = [MovementType.TRANSFER, MovementType.CARD_PAYMENT];

class ImportReviewServiceImpl extends BaseService {
  /** Movimentações novas daquela importação (exclui excluídas logicamente). */
  static newMovements(movements: Movement[], importId: UUID): Movement[] {
    return movements
      .filter((m) => m.import_id === importId && !m.deleted_at)
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  }

  /** Base de comparação: tudo que já existia antes daquela importação. */
  static baseline(movements: Movement[], importId: UUID): Movement[] {
    return movements.filter((m) => m.import_id !== importId && !m.deleted_at);
  }

  static buildRow(
    movement: Movement,
    rules: ClassificationRule[],
    baseline: Movement[],
  ): ImportReviewRow {
    const simulation = rules.length
      ? ClassificationRuleServiceImpl.simulate(
          {
            description: movement.description,
            type: movement.type,
            amount: movement.amount,
            account_id: movement.account_id,
            transfer_account_id: movement.transfer_account_id,
            card_id: movement.card_id,
          },
          rules,
        )
      : null;

    const autoClassified =
      !!movement.category_id &&
      !!simulation?.rule &&
      simulation.categoryId === movement.category_id;

    const match = SimilarityServiceImpl.bestMatch(
      {
        id: movement.id,
        account_id: movement.account_id,
        card_id: movement.card_id,
        description: movement.description,
        amount: movement.amount,
        transaction_date: movement.transaction_date,
        duplicate_hash: movement.duplicate_hash ?? null,
        type: movement.type,
      },
      baseline,
    );
    const duplicateOf =
      match && match.score.confidence_match >= REVIEW_THRESHOLD
        ? {
            movement: match.movement,
            confidence: match.score.confidence_match,
            label: match.score.label,
          }
        : null;

    const flags: ImportReviewFlag[] = [];
    if (!movement.category_id && !CATEGORY_EXEMPT.includes(movement.type)) {
      flags.push("NO_CATEGORY");
    }
    if (autoClassified && simulation?.specificityLabel === "Baixa") {
      flags.push("LOW_SPECIFICITY");
    }
    if (simulation && simulation.candidates.length > 1) {
      const [first, second] = simulation.candidates;
      if (
        second &&
        first.specificity === second.specificity &&
        first.rule.priority === second.rule.priority &&
        first.rule.category_id !== second.rule.category_id
      ) {
        flags.push("AMBIGUOUS_RULE");
      }
    }
    if (duplicateOf) flags.push("POSSIBLE_DUPLICATE");

    return { movement, simulation, autoClassified, duplicateOf, flags };
  }

  static buildRows(
    movements: Movement[],
    importId: UUID,
    rules: ClassificationRule[],
  ): ImportReviewRow[] {
    const baseline = ImportReviewServiceImpl.baseline(movements, importId);
    return ImportReviewServiceImpl.newMovements(movements, importId).map((m) =>
      ImportReviewServiceImpl.buildRow(m, rules, baseline),
    );
  }

  static summarize(rows: ImportReviewRow[]): ImportReviewSummary {
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      const amount = Math.abs(Number(r.movement.amount) || 0);
      if (r.movement.type === MovementType.INCOME) income += amount;
      else if (r.movement.type === MovementType.EXPENSE) expense += amount;
    }
    return {
      total: rows.length,
      autoClassified: rows.filter((r) => r.autoClassified).length,
      withoutCategory: rows.filter((r) => r.flags.includes("NO_CATEGORY")).length,
      needsAttention: rows.filter((r) => r.flags.length > 0).length,
      possibleDuplicates: rows.filter((r) => r.flags.includes("POSSIBLE_DUPLICATE")).length,
      income,
      expense,
      net: income - expense,
    };
  }

  static isReviewed(record: ImportRecord): boolean {
    return !!record.reviewed_at;
  }
}

export const ImportReviewService = new ImportReviewServiceImpl();
export { ImportReviewServiceImpl };
