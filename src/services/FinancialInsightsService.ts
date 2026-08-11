// FinancialInsightsService — Sprint 4.1.2 (Actionable Financial Insights)
// Gera insights financeiros acionáveis a partir de dados já carregados.
// 100% puro (sem I/O): recebe o estado financeiro e devolve insights ordenados,
// cada um com objeto relacionado → ação → deep link → filtros.
// Nenhum componente React monta rota ou filtro manualmente.
import { DashboardService } from "./DashboardService";
import { DashboardFilterService } from "./DashboardFilterService";
import { MonthlyBudgetService } from "./MonthlyBudgetService";

import { MovementType } from "@/constants/enums";
import type { Movement, UUID, Card, ClassificationRule } from "@/models";
import type {
  FinancialInsight,
  InsightSeverity,
  InsightSummary,
  InsightsResult,
} from "@/models/Insight";
import type { PatrimonySnapshot } from "./PatrimonyService";
import type { NetWorthPoint, MonthSummary } from "./DashboardService";
import type { RuleIntegrityReport } from "./RuleIntegrityService";
import type { DateRange } from "./DashboardFilterService";
import type { GoalBudgetRelation, GoalProgress } from "@/models/FinancialGoal";
import type { BudgetComparison } from "@/models/MonthlyBudget";
import type { AnalyticsReport } from "@/models/Analytics";


/** Par de duplicidade reduzido ao que o insight precisa (sem I/O). */
export interface InsightDuplicatePair {
  confidence: number;
  amount: number;
  description: string;
}

export interface InsightsInput {
  range: DateRange;
  previousRange: DateRange;
  movements: Movement[];
  categories: Array<{ id: UUID; name: string }>;
  snapshot: PatrimonySnapshot;
  netWorthSeries: NetWorthPoint[];
  summary: MonthSummary;
  previousSummary?: MonthSummary;
  duplicatePairs?: InsightDuplicatePair[];
  ruleReport?: RuleIntegrityReport | null;
  rules?: ClassificationRule[];
  cards?: Card[];
  /** Quantidade de inconsistências no último Health Check (null = sem execução). */
  healthIssues?: number | null;
  healthCheckedAt?: string | null;
  /** Comparação Planejado x Realizado do mês (Sprint 4.3). */
  budget?: BudgetComparison | null;
  /** Progresso das metas financeiras (Sprint 4.4). */
  goals?: GoalProgress[];
  /** Relação metas x orçamento do mês (Sprint 4.4.1). */
  goalBudget?: GoalBudgetRelation[];
  /** Relatório comportamental do FinancialAnalyticsService (Sprint 4.5). */
  analytics?: AnalyticsReport | null;
}


const LEVEL_WEIGHT: Record<InsightSeverity, number> = {
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

type InsightDraft = Omit<
  FinancialInsight,
  "created_at" | "priority" | "resolved" | "details" | "signature" | "quantity" | "value"
> & {
  created_at?: string;
  priority?: number;
  resolved?: boolean;
  details?: FinancialInsight["details"];
  signature?: string;
  quantity?: number;
  value?: number;
  bonus?: number;
};

class FinancialInsightsServiceImpl {
  /** Compatibilidade: lista simples de insights, já ordenada. */
  build(input: InsightsInput): FinancialInsight[] {
    return this.analyze(input).insights;
  }

  /** Constrói insights acionáveis + resumo executivo. */
  analyze(input: InsightsInput): InsightsResult {
    const now = new Date().toISOString();
    const out: FinancialInsight[] = [];
    const seen = new Set<string>();

    const push = (draft: InsightDraft) => {
      if (seen.has(draft.id)) return;
      seen.add(draft.id);
      const quantity = draft.quantity ?? 0;
      const value = draft.value ?? 0;
      out.push({
        ...draft,
        quantity,
        value,
        details: draft.details ?? [],
        created_at: draft.created_at ?? now,
        resolved: draft.resolved ?? draft.severity === "INFO",
        priority: LEVEL_WEIGHT[draft.severity] + (draft.bonus ?? 0),
        signature:
          draft.signature ?? `${draft.id}:${quantity}:${Math.round(value * 100)}`,
      });
    };

    const {
      movements,
      range,
      previousRange,
      summary,
      snapshot,
      netWorthSeries,
      categories,
      cards = [],
      rules = [],
    } = input;

    const previousSummary =
      input.previousSummary ?? DashboardService.summaryInRange(movements, previousRange);

    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const cardName = new Map(cards.map((c) => [c.id, c.name]));

    // ── 1. Tendência de despesas por categoria (agrupado por categoria).
    const currentByCat = DashboardService.expensesByCategoryInRange(movements, range);
    const prevByCat = DashboardService.expensesByCategoryInRange(movements, previousRange);
    const prevMap = new Map(prevByCat.map((c) => [c.id, c.amount]));

    for (const item of currentByCat.slice(0, 5)) {
      const previous = prevMap.get(item.id) ?? 0;
      const variation = pct(item.amount, previous);
      if (variation === null || Math.abs(variation) < 10) continue;
      const name = item.id ? (catName.get(item.id) ?? "Sem categoria") : "Sem categoria";
      const up = variation > 0;
      const severity: InsightSeverity = up && variation >= 30 ? "WARNING" : "INFO";
      push({
        id: `spend:${item.id ?? "none"}`,
        type: "SPENDING_TREND",
        severity,
        title: `${name} ${up ? "aumentou" : "reduziu"} ${Math.abs(variation).toFixed(0)}%.`,
        description: `${fmtBRL(item.amount)} no período contra ${fmtBRL(previous)} no período anterior.`,
        source: "DASHBOARD",
        related_entity: "category",
        related_entity_id: item.id ?? null,
        quantity: 1,
        value: Number(variation.toFixed(1)),
        recommended_action: "CLASSIFY_MOVEMENTS",
        action_label: "Ver lançamentos",
        action_route: "/movimentacoes",
        action_filters: item.id ? { category: item.id } : {},
        dismissible: true,
        bonus: Math.min(Math.abs(variation), 99),
        details: [
          { label: "Período atual", amount: item.amount },
          { label: "Período anterior", amount: previous },
        ],
      });
    }

    // ── 2. Receita (positivo quando cresce).
    const incomeVar = pct(summary.income, previousSummary.income);
    if (incomeVar !== null && Math.abs(incomeVar) >= 5) {
      const down = incomeVar < 0;
      const severity: InsightSeverity = down && incomeVar <= -15 ? "WARNING" : "INFO";
      push({
        id: "income:trend",
        type: "INCOME_TREND",
        severity,
        title: down
          ? `Receita caiu ${Math.abs(incomeVar).toFixed(0)}%.`
          : `Receita foi maior que o período anterior (+${incomeVar.toFixed(0)}%).`,
        description: `${fmtBRL(summary.income)} contra ${fmtBRL(previousSummary.income)} no período anterior.`,
        source: "DASHBOARD",
        related_entity: "workspace",
        related_entity_id: null,
        quantity: 1,
        value: Number(incomeVar.toFixed(1)),
        recommended_action: "OPEN_DASHBOARD",
        action_label: "Abrir Dashboard",
        action_route: "/dashboard",
        action_filters: {},
        dismissible: true,
        bonus: 50,
        details: [
          { label: "Receita do período", amount: summary.income },
          { label: "Período anterior", amount: previousSummary.income },
        ],
      });
    }

    // ── 3. Patrimônio em novo recorde.
    if (netWorthSeries.length >= 2) {
      const last = netWorthSeries[netWorthSeries.length - 1];
      const max = Math.max(...netWorthSeries.map((p) => p.netWorth));
      if (last.netWorth >= max && last.netWorth > 0) {
        push({
          id: "networth:peak",
          type: "NET_WORTH",
          severity: "INFO",
          title: "Patrimônio atingiu novo recorde.",
          description: `Patrimônio líquido de ${fmtBRL(last.netWorth)} — maior valor da série.`,
          source: "PATRIMONY",
          related_entity: "workspace",
          related_entity_id: null,
          quantity: 1,
          value: last.netWorth,
          recommended_action: "OPEN_DASHBOARD",
          action_label: "Abrir Dashboard",
          action_route: "/dashboard",
          action_filters: {},
          dismissible: true,
          bonus: 60,
        });
      }
    }

    // ── 4. Lançamentos sem categoria (agrupado, com os 3 maiores).
    const unclassifiedList = movements.filter(
      (m) =>
        !m.deleted_at &&
        !m.category_id &&
        m.type !== MovementType.TRANSFER &&
        m.type !== MovementType.CARD_PAYMENT,
    );
    const unclassified = unclassifiedList.length;
    const unclassifiedTotal = unclassifiedList.reduce(
      (s, m) => s + Math.abs(Number(m.amount)),
      0,
    );
    if (unclassified > 0) {
      const top = [...unclassifiedList]
        .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
        .slice(0, 3);
      push({
        id: "movements:unclassified",
        type: "UNCLASSIFIED",
        severity: unclassified >= 20 ? "WARNING" : "INFO",
        title: `${unclassified} lançamentos sem categoria (${fmtBRL(unclassifiedTotal)}).`,
        description: "Classifique-os para melhorar a precisão dos indicadores.",
        source: "MOVEMENTS",
        related_entity: "movement",
        related_entity_id: top[0]?.id ?? null,
        quantity: unclassified,
        value: unclassifiedTotal,
        recommended_action: "CLASSIFY_MOVEMENTS",
        action_label: "Classificar",
        action_route: "/movimentacoes",
        action_filters: { category: "null" },
        dismissible: true,
        bonus: 70,
        details: top.map((m) => ({
          label: m.description,
          amount: Math.abs(Number(m.amount)),
          date: m.transaction_date,
        })),
      });
    } else {
      push({
        id: "movements:all-classified",
        type: "UNCLASSIFIED",
        severity: "INFO",
        title: "Nenhum lançamento sem categoria.",
        description: "Todas as movimentações do workspace estão classificadas.",
        source: "MOVEMENTS",
        related_entity: "movement",
        related_entity_id: null,
        quantity: 0,
        value: 0,
        recommended_action: "CLASSIFY_MOVEMENTS",
        action_label: "Abrir Movimentações",
        action_route: "/movimentacoes",
        action_filters: {},
        dismissible: true,
        bonus: 10,
      });
    }

    // ── 5. Duplicidades a revisar (agrupado, com confidence médio e maior valor).
    const pairs = input.duplicatePairs ?? [];
    if (pairs.length > 0) {
      const avg = pairs.reduce((s, p) => s + p.confidence, 0) / pairs.length;
      const biggest = pairs.reduce((a, b) => (b.amount > a.amount ? b : a));
      push({
        id: "dedup:review",
        type: "DUPLICATES",
        severity: "WARNING",
        title: `${pairs.length} lançamentos muito semelhantes aguardam revisão.`,
        description: `Confiança média de ${avg.toFixed(0)}%. Nada é excluído automaticamente.`,
        source: "DEDUP",
        related_entity: "movement",
        related_entity_id: null,
        quantity: pairs.length,
        value: biggest.amount,
        recommended_action: "REVIEW_DUPLICATES",
        action_label: "Revisar",
        action_route: "/duplicidades",
        action_filters: {},
        dismissible: true,
        bonus: 80,
        details: [
          { label: "Confiança média", value: `${avg.toFixed(0)}%` },
          { label: `Maior valor — ${biggest.description}`, amount: biggest.amount },
        ],
      });
    } else {
      push({
        id: "dedup:clean",
        type: "DUPLICATES",
        severity: "INFO",
        title: "Nenhuma duplicidade encontrada.",
        description: "A deduplicação inteligente não encontrou lançamentos semelhantes.",
        source: "DEDUP",
        related_entity: "movement",
        related_entity_id: null,
        quantity: 0,
        value: 0,
        recommended_action: "REVIEW_DUPLICATES",
        action_label: "Abrir Duplicidades",
        action_route: "/duplicidades",
        action_filters: {},
        dismissible: true,
        bonus: 9,
      });
    }

    // ── 6. Integridade das regras.
    const report = input.ruleReport;
    const ruleById = new Map(rules.map((r) => [r.id, r]));
    if (report) {
      if (report.conflicts.length) {
        const details = report.conflicts.slice(0, 3).map((issue) => {
          const group = issue.ruleIds.map((id) => ruleById.get(id)).filter(Boolean);
          const cats = group
            .map((r) => (r?.category_id ? (catName.get(r.category_id) ?? "—") : "Sem categoria"))
            .join(" × ");
          const lastUsed = group
            .map((r) => r?.last_matched_at ?? null)
            .filter((d): d is string => !!d)
            .sort()
            .pop();
          return {
            label: issue.id.replace(/^conf:/, ""),
            value: cats || "categorias diferentes",
            date: lastUsed ?? undefined,
          };
        });
        push({
          id: "rules:conflicts",
          type: "RULES_CONFLICT",
          severity: "CRITICAL",
          title: `${report.conflicts.length} grupos de regras conflitantes.`,
          description:
            "Regras com o mesmo fingerprint apontam para categorias diferentes — a classificação fica imprevisível.",
          source: "RULES",
          related_entity: "rule",
          related_entity_id: report.conflicts[0]?.ruleIds[0] ?? null,
          quantity: report.conflicts.length,
          value: report.conflicts.length,
          recommended_action: "OPEN_RULES",
          action_label: "Abrir Regras",
          action_route: "/regras",
          action_filters: { status: "conflict" },
          dismissible: false,
          bonus: 90,
          details,
        });
      }
      if (report.duplicates.length) {
        const details = report.duplicates.slice(0, 3).map((issue) => {
          const group = issue.ruleIds.map((id) => ruleById.get(id)).filter(Boolean);
          const maxPriority = Math.max(0, ...group.map((r) => r?.priority ?? 0));
          return {
            label: issue.id.replace(/^dup:/, ""),
            value: `${group.length} regras · maior prioridade ${maxPriority}`,
          };
        });
        push({
          id: "rules:duplicates",
          type: "RULES_DUPLICATE",
          severity: "WARNING",
          title: `${report.duplicates.length} grupos de regras duplicadas.`,
          description: "Consolide as regras repetidas para simplificar a manutenção.",
          source: "RULES",
          related_entity: "rule",
          related_entity_id: report.duplicates[0]?.ruleIds[0] ?? null,
          quantity: report.duplicates.length,
          value: report.duplicates.length,
          recommended_action: "OPEN_RULE_INTEGRITY",
          action_label: "Abrir Integridade",
          action_route: "/regras",
          action_filters: { status: "duplicate" },
          dismissible: true,
          bonus: 40,
          details,
        });
      }
      if (!report.conflicts.length && !report.duplicates.length && report.total > 0) {
        push({
          id: "rules:consistent",
          type: "RULES_CONFLICT",
          severity: "INFO",
          title: "Todas as regras estão consistentes.",
          description: `${report.total} regras sem conflitos nem duplicidades.`,
          source: "RULES",
          related_entity: "rule",
          related_entity_id: null,
          quantity: report.total,
          value: report.total,
          recommended_action: "OPEN_RULES",
          action_label: "Abrir Regras",
          action_route: "/regras",
          action_filters: { status: "all" },
          dismissible: true,
          bonus: 8,
        });
      }
    }

    // ── 7. Participação do cartão nos gastos.
    const inRange = movements.filter(
      (m) =>
        !m.deleted_at &&
        DashboardFilterService.contains(range, m.competence_date ?? m.transaction_date),
    );
    const expenses = inRange.filter((m) => m.type === MovementType.EXPENSE);
    const totalExpense = expenses.reduce((s, m) => s + Math.abs(Number(m.amount)), 0);
    const cardExpenses = expenses.filter((m) => !!m.card_id);
    const cardExpense = cardExpenses.reduce((s, m) => s + Math.abs(Number(m.amount)), 0);
    if (totalExpense > 0 && cardExpense > 0) {
      const share = (cardExpense / totalExpense) * 100;

      const byCard = new Map<string, number>();
      for (const m of cardExpenses) {
        const key = m.card_id as string;
        byCard.set(key, (byCard.get(key) ?? 0) + Math.abs(Number(m.amount)));
      }
      const topCard = [...byCard.entries()].sort((a, b) => b[1] - a[1])[0];

      const byCat = new Map<string, number>();
      for (const m of cardExpenses.filter((m) => m.card_id === topCard[0])) {
        const key = m.category_id ?? "none";
        byCat.set(key, (byCat.get(key) ?? 0) + Math.abs(Number(m.amount)));
      }
      const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

      push({
        id: "cards:share",
        type: "CARD_SHARE",
        severity: share >= 70 ? "WARNING" : "INFO",
        title: `Seu cartão representa ${share.toFixed(0)}% dos gastos.`,
        description: `${fmtBRL(cardExpense)} de ${fmtBRL(totalExpense)} em despesas do período.`,
        source: "CARDS",
        related_entity: "card",
        related_entity_id: topCard[0],
        quantity: byCard.size,
        value: Number(share.toFixed(1)),
        recommended_action: "OPEN_CARD",
        action_label: "Abrir Cartão",
        action_route: "/cartoes",
        action_filters: { card: topCard[0] },
        dismissible: true,
        bonus: 30,
        details: [
          {
            label: `Cartão responsável — ${cardName.get(topCard[0]) ?? "Cartão"}`,
            amount: topCard[1],
          },
          ...(topCat
            ? [
                {
                  label: `Maior categoria — ${
                    topCat[0] === "none" ? "Sem categoria" : (catName.get(topCat[0]) ?? "—")
                  }`,
                  amount: topCat[1],
                },
              ]
            : []),
        ],
      });
    }

    // ── 8. Cartões conciliados (positivo).
    if (cards.length > 0 && cardExpenses.every((m) => !!m.invoice_id)) {
      push({
        id: "cards:reconciled",
        type: "CARDS_RECONCILED",
        severity: "INFO",
        title: "Todos os cartões conciliados.",
        description: "Todas as compras de cartão do período estão vinculadas a uma fatura.",
        source: "CARDS",
        related_entity: "card",
        related_entity_id: null,
        quantity: cards.length,
        value: cardExpense,
        recommended_action: "OPEN_CARD",
        action_label: "Abrir Cartões",
        action_route: "/cartoes",
        action_filters: {},
        dismissible: true,
        bonus: 7,
      });
    }

    // ── 9. Health Check.
    const healthIssues = input.healthIssues ?? null;
    if (healthIssues !== null) {
      const ok = healthIssues === 0;
      push({
        id: "health:status",
        type: "HEALTH_CHECK",
        severity: ok ? "INFO" : "CRITICAL",
        title: ok
          ? "Health Check sem inconsistências."
          : `Health Check encontrou ${healthIssues} inconsistências.`,
        description: ok
          ? "A última verificação de integridade financeira não encontrou problemas."
          : "Execute novamente o Health Check e revise os itens sinalizados.",
        source: "HEALTH",
        related_entity: "health_check",
        related_entity_id: null,
        quantity: healthIssues,
        value: healthIssues,
        recommended_action: "RUN_HEALTH_CHECK",
        action_label: ok ? "Abrir Configurações" : "Executar Health Check",
        action_route: "/configuracoes",
        action_filters: {},
        dismissible: ok,
        bonus: ok ? 6 : 95,
        signature: `health:${healthIssues}:${input.healthCheckedAt ?? ""}`,
      });
    }

    // ── 10. Saldo projetado.
    const projection = snapshot.cash + summary.result;
    const previousProjection = snapshot.cash + previousSummary.result;
    const diff = projection - previousProjection;
    const diffPct = pct(projection, previousProjection);
    push({
      id: "projection:balance",
      type: "PROJECTION",
      severity: projection < 0 ? "CRITICAL" : "INFO",
      title: `Saldo projetado para o final do período: ${fmtBRL(projection)}.`,
      description:
        projection < 0
          ? "A projeção indica saldo negativo — revise despesas previstas."
          : "Projeção baseada no saldo atual e no resultado do período.",
      source: "DASHBOARD",
      related_entity: "workspace",
      related_entity_id: null,
      quantity: 1,
      value: projection,
      recommended_action: "OPEN_DASHBOARD",
      action_label: "Abrir Dashboard",
      action_route: "/dashboard",
      action_filters: {},
      dismissible: projection >= 0,
      bonus: 20,
      details: [
        { label: "Diferença para o período anterior", amount: diff },
        ...(diffPct !== null
          ? [{ label: "Variação", value: `${diffPct.toFixed(1)}%` }]
          : []),
      ],
    });

    // ── 11. Planejamento Mensal (Sprint 4.3) — alertas de orçamento.
    for (const insight of this.budgetInsights(input.budget ?? null)) {
      push({ ...insight, bonus: insight.priority });
    }

    // ── 12. Metas Financeiras (Sprint 4.4).
    for (const insight of this.goalInsights(input.goals ?? [])) {
      push({ ...insight, bonus: insight.priority });
    }

    // ── 13. Metas x Planejamento (Sprint 4.4.1).
    for (const insight of this.goalBudgetInsights(input.goalBudget ?? [])) {
      push({ ...insight, bonus: insight.priority });
    }

    // ── 14. Comportamento financeiro (Sprint 4.5).
    for (const insight of this.behaviorInsights(input.analytics ?? null)) {
      push({ ...insight, bonus: insight.priority });
    }


    const insights = out.sort((a, b) => b.priority - a.priority);
    return { insights, summary: this.summarize(insights) };
  }

  /**
   * Alertas das Metas Financeiras. Recebe o progresso já calculado pelo
   * FinancialGoalService — nenhum cálculo financeiro acontece aqui.
   */
  goalInsights(goals: GoalProgress[]): FinancialInsight[] {
    const now = new Date().toISOString();
    const out: FinancialInsight[] = [];

    const base = (over: Partial<FinancialInsight>): FinancialInsight => ({
      id: "goal",
      type: "GOAL",
      severity: "INFO",
      title: "",
      description: "",
      source: "GOALS",
      related_entity: "goal",
      related_entity_id: null,
      quantity: 1,
      value: 0,
      recommended_action: "OPEN_GOAL",
      action_label: "Ver metas",
      action_route: "/metas",
      action_filters: {},
      dismissible: true,
      created_at: now,
      resolved: false,
      priority: 100,
      details: [],
      signature: "goal",
      ...over,
    });

    for (const g of goals.filter((x) => x.status === "ACTIVE")) {
      if (g.level === "LATE") {
        out.push(
          base({
            id: `goal:late:${g.goalId}`,
            severity: "WARNING",
            title: `Meta atrasada: ${g.name}`,
            description: `Faltam ${g.remaining.toFixed(2)} para atingir a meta e o ritmo atual está abaixo do necessário.`,
            related_entity_id: g.goalId,
            value: g.remaining,
            action_filters: { search: g.goalId },
            priority: 210,
            signature: `goal:late:${g.goalId}:${Math.round(g.percent ?? 0)}`,
            details: [
              { label: "Percentual atingido", value: `${(g.percent ?? 0).toFixed(1)}%` },
              ...(g.requiredMonthly !== null
                ? [{ label: "Aporte necessário por mês", amount: g.requiredMonthly }]
                : []),
            ],
          }),
        );
      } else if (g.level === "ATTENTION") {
        out.push(
          base({
            id: `goal:attention:${g.goalId}`,
            severity: "INFO",
            title: `Meta em atenção: ${g.name}`,
            description: "O ritmo está um pouco abaixo do esperado para o prazo definido.",
            related_entity_id: g.goalId,
            value: g.remaining,
            priority: 150,
            signature: `goal:attention:${g.goalId}:${Math.round(g.percent ?? 0)}`,
          }),
        );
      }

      if (g.daysSinceLastContribution !== null && g.daysSinceLastContribution >= 60) {
        out.push(
          base({
            id: `goal:stale:${g.goalId}`,
            severity: "INFO",
            title: `Sem aportes há ${g.daysSinceLastContribution} dias: ${g.name}`,
            description: "Registre um aporte para manter a previsão de conclusão confiável.",
            related_entity_id: g.goalId,
            priority: 140,
            signature: `goal:stale:${g.goalId}:${g.daysSinceLastContribution}`,
          }),
        );
      }

      if (
        g.source === "ACCOUNTS" &&
        g.remaining > 0 &&
        g.monthlyPace === null
      ) {
        out.push(
          base({
            id: `goal:no-progress:${g.goalId}`,
            severity: "INFO",
            title: `Meta sem evolução: ${g.name}`,
            description:
              "As contas vinculadas não registraram evolução suficiente para calcular um ritmo.",
            related_entity_id: g.goalId,
            priority: 135,
            signature: `goal:no-progress:${g.goalId}`,
          }),
        );
      }

      if (g.remaining <= 0) {
        out.push(
          base({
            id: `goal:done:${g.goalId}`,
            severity: "INFO",
            title: `Meta atingida: ${g.name}`,
            description: "Você pode concluir esta meta ou definir um novo alvo.",
            related_entity_id: g.goalId,
            value: g.current,
            priority: 130,
            signature: `goal:done:${g.goalId}`,
          }),
        );
      }
    }

    return out;
  }

  /**
   * Alertas de metas cujo aporte necessário não cabe na sobra planejada do
   * mês. O cálculo vem pronto do FinancialGoalService.budgetRelation.
   */
  goalBudgetInsights(relations: GoalBudgetRelation[]): FinancialInsight[] {
    const now = new Date().toISOString();
    return relations
      .filter((r) => r.feasible === false && r.requiredMonthly !== null)
      .map((r) => ({
        id: `goal:budget:${r.goalId}`,
        type: "GOAL" as const,
        severity: "WARNING" as const,
        title: `Planejamento insuficiente para a meta: ${r.name}`,
        description:
          "O aporte mensal necessário é maior do que a sobra planejada no orçamento do mês.",
        source: "GOALS" as const,
        related_entity: "goal" as const,
        related_entity_id: r.goalId,
        quantity: 1,
        value: Math.abs(r.difference ?? 0),
        recommended_action: "OPEN_GOAL" as const,
        action_label: "Ver metas",
        action_route: "/metas",
        action_filters: {},
        dismissible: true,
        created_at: now,
        resolved: false,
        priority: 205,
        details: [
          { label: "Necessário por mês", amount: r.requiredMonthly ?? 0 },
          { label: "Sobra planejada", amount: r.plannedAvailable },
        ],
        signature: `goal:budget:${r.goalId}:${Math.round(r.difference ?? 0)}`,
      }));
  }

  /**
   * Alertas do Planejamento Mensal. Recebe a comparação já calculada pelo
   * MonthlyBudgetService — aqui não há cálculo financeiro novo.
   */
  budgetInsights(budget: BudgetComparison | null): FinancialInsight[] {
    if (!budget) return [];
    const now = new Date().toISOString();
    const out: FinancialInsight[] = [];
    const period = `${String(budget.month).padStart(2, "0")}/${budget.year}`;

    const base = (over: Partial<FinancialInsight>): FinancialInsight => ({
      id: "budget",
      type: "BUDGET",
      severity: "INFO",
      title: "",
      description: "",
      source: "BUDGET",
      related_entity: "budget",
      related_entity_id: budget.budgetId,
      quantity: 1,
      value: 0,
      recommended_action: "OPEN_BUDGET",
      action_label: "Abrir Planejamento",
      action_route: "/planejamento",
      action_filters: {},
      dismissible: true,
      created_at: now,
      resolved: false,
      priority: 0,
      details: [],
      signature: "",
      ...over,
    });

    const expenses = budget.lines.filter((l) => l.kind === "EXPENSE" && l.planned > 0);

    for (const line of expenses) {
      const p = line.percent ?? 0;
      const label = line.subcategoryName
        ? `${line.categoryName} › ${line.subcategoryName}`
        : line.categoryName;
      if (p > 100) {
        out.push(
          base({
            id: `budget:over:${line.key}`,
            severity: "CRITICAL",
            title: `${label} ultrapassou o orçamento de ${period}.`,
            description: `Planejado ${fmtBRL(line.planned)} e realizado ${fmtBRL(line.actual)} (${p.toFixed(0)}%).`,
            related_entity: "category",
            related_entity_id: line.categoryId,
            value: line.actual - line.planned,
            dismissible: false,
            priority: 90,
            details: [
              { label: "Planejado", amount: line.planned },
              { label: "Realizado", amount: line.actual },
              { label: "Excedente", amount: line.actual - line.planned },
            ],
            signature: `budget:over:${line.key}:${Math.round(p)}`,
          }),
        );
      } else if (p >= 90) {
        out.push(
          base({
            id: `budget:90:${line.key}`,
            severity: "WARNING",
            title: `${label} atingiu 90% do orçamento de ${period}.`,
            description: `Restam ${fmtBRL(line.remaining)} para o período.`,
            related_entity: "category",
            related_entity_id: line.categoryId,
            value: line.remaining,
            priority: 70,
            signature: `budget:90:${line.key}:${Math.round(p)}`,
          }),
        );
      } else if (p >= 80) {
        out.push(
          base({
            id: `budget:80:${line.key}`,
            severity: "WARNING",
            title: `${label} atingiu 80% do orçamento de ${period}.`,
            description: `Restam ${fmtBRL(line.remaining)} para o período.`,
            related_entity: "category",
            related_entity_id: line.categoryId,
            value: line.remaining,
            priority: 55,
            signature: `budget:80:${line.key}:${Math.round(p)}`,
          }),
        );
      }
    }

    const savings = expenses
      .filter((l) => l.difference > 0 && (l.percent ?? 0) <= 70)
      .sort((a, b) => b.difference - a.difference);
    const bestSaving = savings[0];
    if (bestSaving && bestSaving.difference > 0) {
      const label = bestSaving.subcategoryName
        ? `${bestSaving.categoryName} › ${bestSaving.subcategoryName}`
        : bestSaving.categoryName;
      out.push(
        base({
          id: "budget:saving",
          severity: "INFO",
          title: `Economia relevante em ${label}: ${fmtBRL(bestSaving.difference)}.`,
          description: `Realizado ${fmtBRL(bestSaving.actual)} contra ${fmtBRL(bestSaving.planned)} planejados.`,
          related_entity: "category",
          related_entity_id: bestSaving.categoryId,
          value: bestSaving.difference,
          resolved: true,
          priority: 30,
          signature: `budget:saving:${bestSaving.key}:${Math.round(bestSaving.difference)}`,
        }),
      );
    }

    const sorted = [...expenses].sort((a, b) => b.difference - a.difference);
    const positive = sorted[0];
    const negative = sorted[sorted.length - 1];
    if (positive && positive.difference > 0) {
      out.push(
        base({
          id: "budget:deviation:positive",
          severity: "INFO",
          title: `Maior desvio positivo: ${positive.categoryName} (${fmtBRL(positive.difference)} abaixo do planejado).`,
          description: "Sobra de orçamento que pode ser realocada.",
          related_entity: "category",
          related_entity_id: positive.categoryId,
          value: positive.difference,
          resolved: true,
          priority: 25,
          signature: `budget:dev+:${positive.key}:${Math.round(positive.difference)}`,
        }),
      );
    }
    if (negative && negative.difference < 0 && negative.key !== positive?.key) {
      out.push(
        base({
          id: "budget:deviation:negative",
          severity: "WARNING",
          title: `Maior desvio negativo: ${negative.categoryName} (${fmtBRL(Math.abs(negative.difference))} acima do planejado).`,
          description: "Revise os lançamentos desta categoria no período.",
          related_entity: "category",
          related_entity_id: negative.categoryId,
          value: Math.abs(negative.difference),
          priority: 60,
          signature: `budget:dev-:${negative.key}:${Math.round(negative.difference)}`,
        }),
      );
    }

    // Categorias sem utilização — planejado reservado e nada gasto.
    const unused = expenses.filter((l) => l.actual === 0);
    if (unused.length > 0) {
      const total = unused.reduce((s, l) => s + l.planned, 0);
      out.push(
        base({
          id: "budget:unused",
          severity: "INFO",
          title: `${unused.length} categoria(s) sem utilização em ${period}.`,
          description: `${fmtBRL(total)} planejados ainda não foram utilizados.`,
          quantity: unused.length,
          value: total,
          resolved: true,
          priority: 20,
          details: unused.slice(0, 3).map((l) => ({
            label: l.subcategoryName ? `${l.categoryName} › ${l.subcategoryName}` : l.categoryName,
            amount: l.planned,
          })),
          signature: `budget:unused:${unused.length}:${Math.round(total)}`,
        }),
      );
    }

    // Maior excesso — abre direto o extrato filtrado (drill down).
    const excess = expenses
      .filter((l) => l.actual > l.planned)
      .sort((a, b) => b.actual - b.planned - (a.actual - a.planned))[0];
    if (excess) {
      const link = MonthlyBudgetService.drillDown({
        year: budget.year,
        month: budget.month,
        categoryId: excess.categoryId,
        subcategoryId: excess.subcategoryId,
      });
      const label = excess.subcategoryName
        ? `${excess.categoryName} › ${excess.subcategoryName}`
        : excess.categoryName;
      out.push(
        base({
          id: "budget:excess",
          severity: "WARNING",
          title: `Maior excesso do orçamento: ${label} (${fmtBRL(excess.actual - excess.planned)}).`,
          description: "Abra os lançamentos do período para revisar os gastos.",
          related_entity: "category",
          related_entity_id: excess.categoryId,
          value: excess.actual - excess.planned,
          recommended_action: "CLASSIFY_MOVEMENTS",
          action_label: "Ver lançamentos",
          action_route: "/movimentacoes",
          action_filters: link.search,
          priority: 65,
          signature: `budget:excess:${excess.key}:${Math.round(excess.actual - excess.planned)}`,
        }),
      );
    }

    return out;
  }



  /** Resumo executivo (contadores por severidade). */
  summarize(insights: FinancialInsight[]): InsightSummary {
    const critical = insights.filter((i) => i.severity === "CRITICAL").length;
    const warning = insights.filter((i) => i.severity === "WARNING").length;
    const info = insights.filter((i) => i.severity === "INFO").length;
    return { critical, warning, info, total: insights.length };
  }
}

export const FinancialInsightsService = new FinancialInsightsServiceImpl();
export { FinancialInsightsServiceImpl };
