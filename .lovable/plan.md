# Sprint 4.2 — Fechamento Mensal (Monthly Closing)

Novo módulo que registra um **snapshot auditável** de cada mês: receitas, despesas, resultado, patrimônio, passivo, qualidade dos dados, Health Check e Insights congelados no momento do fechamento. O sistema continua calculando tudo normalmente — o snapshot é apenas histórico.

## O que o usuário vai ver

1. **Nova página "Fechamentos"** (item novo na barra lateral) com a lista de meses: ano, mês, status, resultado, patrimônio, passivo, data e quem fechou.
2. **Botão "Fechar mês"**: antes de gravar, mostra um resumo de avisos (duplicidades, lançamentos sem categoria, regras conflitantes, alertas críticos de Health Check). Os avisos nunca bloqueiam — o usuário confirma e o fechamento é gravado.
3. **Visualizar Snapshot**: tela de leitura que mostra exatamente os números congelados (nunca recalcula), incluindo resumo por categoria, subcategoria, contas e cartões, e os insights daquele momento.
4. **Reabertura**: reabre um mês fechado exigindo um motivo; a reabertura fica registrada no histórico de auditoria e um novo fechamento gera um novo snapshot.
5. **Selo "Desatualizado"**: se houver movimentações criadas/alteradas no mês depois do fechamento, o registro é marcado como desatualizado com a opção de refazer o fechamento. O snapshot antigo nunca é alterado silenciosamente.
6. **Card no Dashboard "Último Fechamento"**: mês, resultado, patrimônio, passivo e situação; clique abre a página de Fechamentos.

## Banco de dados

Tabela `monthly_closings` (com RLS por workspace do dono e GRANTs padrão):
`id, workspace_id, year, month, status (OPEN | CLOSED | LOCKED), closed_at, closed_by, reopened_at, reopened_by, reopen_reason, notes, snapshot_json, created_at, updated_at, deleted_at`, índice único por `(workspace_id, year, month)` entre registros não excluídos.

Tabela `monthly_closing_events` para auditoria completa: `closing_id, workspace_id, event (CLOSED | REOPENED | RECLOSED), reason, performed_by, created_at`.

Nenhum saldo, fatura ou indicador derivado é gravado fora do `snapshot_json`.

## Camada técnica

- `src/models/MonthlyClosing.ts` — tipos `MonthlyClosing`, `MonthlyClosingStatus`, `ClosingSnapshot` (blocos: totals, quality, health, insights, cards, investments, transfers, byCategory, bySubcategory, byAccount, byCard), `ClosingComparison`, `ClosingEvent`. Os blocos `totals/byCategory/bySubcategory` já ficam no formato que o Planejamento Mensal vai consumir na próxima sprint.
- `src/services/MonthlyClosingService.ts` — única fonte de regra: `buildSnapshot()` (puro, monta o snapshot a partir dos dados já carregados via `DashboardService`, `PatrimonyService`, `FinancialInsightsService`, `RuleIntegrityService`), `validate()` (avisos pré-fechamento), `close()`, `reopen()`, `reclose()`, `list()`, `get()`, `compareClosing()` (diferenças absolutas e percentuais entre dois snapshots), `isStale()` (compara `closed_at` com o `updated_at` mais recente das movimentações do mês). No `close()`, chama a RPC `financial_health_check` e grava o resultado dentro do snapshot.
- `src/hooks/useMonthlyClosings.ts` — React Query: lista, detalhe, mutations de fechar/reabrir/refechar, invalidando via `invalidateFinancialQueries` + chave `monthly-closings`.
- Componentes em `src/components/closings/`: `ClosingList`, `ClosingRow`, `CloseMonthDialog` (avisos + confirmação), `ReopenDialog` (motivo), `SnapshotView`, `ClosingAuditTrail`. Só apresentação.
- `src/components/dashboard/widgets/LastClosingWidget.tsx` + registro no `index.ts` e no `dashboard.tsx`.
- Rota `src/routes/_authenticated/fechamentos.tsx` com `validateSearch` para `year`/`month` (deep link), entrada em `ROUTES.FECHAMENTOS` e no menu do `MainLayout`.
- Testes em `src/services/__tests__/MonthlyClosing.test.ts`: fechamento simples, reabertura, novo fechamento, integridade do snapshot, comparação entre meses, Health Check e Insights incorporados, detecção de desatualizado, histórico.

Arquitetura preservada: componentes não calculam nada, hooks só orquestram cache, toda regra fica no Service. Nenhuma regra financeira existente é alterada. Planejamento Mensal, metas e IA ficam fora desta sprint.
