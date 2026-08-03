// FinancialInsightsService — Sprint 4.1.1
// Gera insights financeiros automáticos a partir de dados já carregados.
// 100% puro (sem I/O): recebe o estado financeiro e devolve insights ordenados.
// Preparado para alimentar Planejamento Mensal, Fechamento Mensal, Relatórios
// Inteligentes e IA futura.
import { DashboardService } from "./DashboardService";
import { DashboardFilterService } from "./DashboardFilterService";
import { MovementType } from "@/constants/enums";
import type { Movement, UUID } from "@/models";
import type { FinancialInsight, InsightLevel } from "@/models/Insight";
import type { PatrimonySnapshot } from "./PatrimonyService";
import type { NetWorthPoint, MonthSummary } from "./DashboardService";
import type { RuleIntegrityReport } from "./RuleIntegrityService";
import type { DateRange } from "./DashboardFilterService";

export interface InsightsInput {
  range: DateRange;
  previousRange: DateRange;
  movements: Movement[];
  categories: Array<{ id: UUID; name: string }>;
  snapshot: PatrimonySnapshot;
  netWorthSeries: NetWorthPoint[];
  summary: MonthSummary;
  previousSummary?: MonthSummary;
  duplicateCount?: number;
  ruleReport?: RuleIntegrityReport | null;
}

const LEVEL_WEIGHT: Record<InsightLevel, number> = {
  CRITICAL: 300,
  WARNING: 200,
  INFO: 100,
};

function pct(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

class FinancialInsightsServiceImpl {
  /** Constrói a lista de insights, já ordenada (CRITICAL → WARNING → INFO). */
  build(input: InsightsInput): FinancialInsight[] {
    const now = new Date().toISOString();
    const out: FinancialInsight[] = [];
    const push = (i: Omit<FinancialInsight, "date"> & { date?: string }) =>
      out.push({ ...i, date: i.date ?? now });

    const {
      movements,
      range,
      previousRange,
      summary,
      snapshot,
      netWorthSeries,
      categories,
    } = input;

    const previousSummary =
      input.previousSummary ?? DashboardService.summaryInRange(movements, previousRange);

    // 1. Tendência de despesas por categoria (maior variação relevante).
    const currentByCat = DashboardService.expensesByCategoryInRange(movements, range);
    const prevByCat = DashboardService.expensesByCategoryInRange(movements, previousRange);
    const prevMap = new Map(prevByCat.map((c) => [c.id, c.amount]));
    const catName = new Map(categories.map((c) => [c.id, c.name]));

    for (const item of currentByCat.slice(0, 5)) {
      const previous = prevMap.get(item.id) ?? 0;
      const variation = pct(item.amount, previous);
      if (variation === null || Math.abs(variation) < 10) continue;
      const name = item.id ? (catName.get(item.id) ?? "Sem categoria") : "Sem categoria";
      const up = variation > 0;
      push({
        id: `spend:${item.id ?? "none"}`,
        type: "SPENDING_TREND",
        category: item.id,
        level: up && variation >= 30 ? "WARNING" : "INFO",
        priority: LEVEL_WEIGHT[up && variation >= 30 ? "WARNING" : "INFO"] + Math.min(Math.abs(variation), 99),
        value: Number(variation.toFixed(1)),
        origin: "DASHBOARD",
        title: `${name} ${up ? "aumentou" : "reduziu"} ${Math.abs(variation).toFixed(0)}%.`,
        description: `${fmtBRL(item.amount)} no período contra ${fmtBRL(previous)} no período anterior.`,
      });
    }

    // 2. Receita.
    const incomeVar = pct(summary.income, previousSummary.income);
    if (incomeVar !== null && Math.abs(incomeVar) >= 5) {
      const down = incomeVar < 0;
      push({
        id: "income:trend",
        type: "INCOME_TREND",
        category: null,
        level: down && incomeVar <= -15 ? "WARNING" : "INFO",
        priority: LEVEL_WEIGHT[down && incomeVar <= -15 ? "WARNING" : "INFO"] + 50,
        value: Number(incomeVar.toFixed(1)),
        origin: "DASHBOARD",
        title: `Receita ${down ? "caiu" : "subiu"} ${Math.abs(incomeVar).toFixed(0)}%.`,
        description: `${fmtBRL(summary.income)} contra ${fmtBRL(previousSummary.income)} no período anterior.`,
      });
    }

    // 3. Patrimônio no maior valor histórico da série.
    if (netWorthSeries.length >= 2) {
      const last = netWorthSeries[netWorthSeries.length - 1];
      const max = Math.max(...netWorthSeries.map((p) => p.netWorth));
      if (last.netWorth >= max && last.netWorth > 0) {
        push({
          id: "networth:peak",
          type: "NET_WORTH",
          category: null,
          level: "INFO",
          priority: LEVEL_WEIGHT.INFO + 60,
          value: last.netWorth,
          origin: "PATRIMONY",
          title: "Patrimônio atingiu o maior valor do período.",
          description: `Patrimônio líquido de ${fmtBRL(last.netWorth)}.`,
        });
      }
    }

    // 4. Lançamentos sem categoria.
    const unclassified = movements.filter(
      (m) =>
        !m.deleted_at &&
        !m.category_id &&
        m.type !== MovementType.TRANSFER &&
        m.type !== MovementType.CARD_PAYMENT,
    ).length;
    if (unclassified > 0) {
      push({
        id: "movements:unclassified",
        type: "UNCLASSIFIED",
        category: null,
        level: unclassified >= 20 ? "WARNING" : "INFO",
        priority: LEVEL_WEIGHT[unclassified >= 20 ? "WARNING" : "INFO"] + 70,
        value: unclassified,
        origin: "MOVEMENTS",
        title: `Existem ${unclassified} lançamentos sem categoria.`,
        description: "Classifique-os para melhorar a precisão dos indicadores.",
      });
    }

    // 5. Duplicidades a revisar.
    const dup = input.duplicateCount ?? 0;
    if (dup > 0) {
      push({
        id: "dedup:review",
        type: "DUPLICATES",
        category: null,
        level: "WARNING",
        priority: LEVEL_WEIGHT.WARNING + 80,
        value: dup,
        origin: "DEDUP",
        title: `Foram encontrados ${dup} lançamentos muito semelhantes.`,
        description: "Revise as duplicidades antes de consolidar. Nada é excluído automaticamente.",
      });
    }

    // 6. Integridade das regras.
    const report = input.ruleReport;
    if (report) {
      if (report.conflicts.length) {
        push({
          id: "rules:conflicts",
          type: "RULES",
          category: null,
          level: "CRITICAL",
          priority: LEVEL_WEIGHT.CRITICAL + 90,
          value: report.conflicts.length,
          origin: "RULES",
          title: `Existem ${report.conflicts.length} regras conflitantes.`,
          description: "Regras com o mesmo fingerprint apontam para categorias diferentes.",
        });
      }
      if (report.duplicates.length) {
        push({
          id: "rules:duplicates",
          type: "RULES",
          category: null,
          level: "WARNING",
          priority: LEVEL_WEIGHT.WARNING + 40,
          value: report.duplicates.length,
          origin: "RULES",
          title: `Existem ${report.duplicates.length} grupos de regras duplicadas.`,
          description: "Consolide as regras repetidas para simplificar a manutenção.",
        });
      }
    }

    // 7. Participação do cartão nos gastos.
    const inRange = movements.filter(
      (m) => !m.deleted_at && DashboardFilterService.contains(range, m.competence_date ?? m.transaction_date),
    );
    const expenses = inRange.filter((m) => m.type === MovementType.EXPENSE);
    const totalExpense = expenses.reduce((s, m) => s + Math.abs(Number(m.amount)), 0);
    const cardExpense = expenses
      .filter((m) => !!m.card_id)
      .reduce((s, m) => s + Math.abs(Number(m.amount)), 0);
    if (totalExpense > 0 && cardExpense > 0) {
      const share = (cardExpense / totalExpense) * 100;
      push({
        id: "cards:share",
        type: "CARD_SHARE",
        category: null,
        level: share >= 70 ? "WARNING" : "INFO",
        priority: LEVEL_WEIGHT[share >= 70 ? "WARNING" : "INFO"] + 30,
        value: Number(share.toFixed(1)),
        origin: "CARDS",
        title: `Seu cartão representa ${share.toFixed(0)}% dos gastos.`,
        description: `${fmtBRL(cardExpense)} de ${fmtBRL(totalExpense)} em despesas do período.`,
      });
    }

    // 8. Projeção de saldo para o fim do período.
    const projection = snapshot.cash + summary.result;
    push({
      id: "projection:balance",
      type: "PROJECTION",
      category: null,
      level: projection < 0 ? "CRITICAL" : "INFO",
      priority: LEVEL_WEIGHT[projection < 0 ? "CRITICAL" : "INFO"] + 20,
      value: projection,
      origin: "DASHBOARD",
      title: `Saldo projetado para o final do período: ${fmtBRL(projection)}.`,
      description:
        projection < 0
          ? "A projeção indica saldo negativo — revise despesas previstas."
          : "Projeção baseada no saldo atual e no resultado do período.",
    });

    return out.sort((a, b) => b.priority - a.priority);
  }
}

export const FinancialInsightsService = new FinancialInsightsServiceImpl();
export { FinancialInsightsServiceImpl };
