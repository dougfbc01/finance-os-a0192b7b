# Sprint 4.1.2 — Actionable Financial Insights

Transformar o widget de Financial Insights de painel informativo em uma Central Inteligente de Ações: todo insight passa a responder o que aconteceu, onde aconteceu e o que fazer agora, com botão que abre a tela correta já filtrada.

## 1. Modelo unificado de Insight

Ampliar `src/models/Insight.ts` com o contrato completo:

`id, type, severity, title, description, source, related_entity, related_entity_id, quantity, value, recommended_action, action_label, action_route, action_filters, dismissible, created_at, resolved`

`severity` substitui `level` (mesmos valores INFO/WARNING/CRITICAL); `source` substitui `origin`. Mantém `priority` interno para ordenação. `action_filters` é um objeto tipado de search params.

## 2. FinancialInsightsService (toda a inteligência)

Refatorar `src/services/FinancialInsightsService.ts` para produzir, em cada insight, o objeto relacionado + ação + rota + filtros. Nenhum componente monta link manualmente.

Insights acionáveis (com detalhe enriquecido):

- **Regras conflitantes** — quantidade, fingerprint, categorias em conflito, última utilização → "Abrir Regras" (`/regras`, filtro `status=conflict`).
- **Regras duplicadas** — fingerprint, quantidade, maior prioridade → "Abrir Integridade" (`/regras`, `status=duplicate`).
- **Lançamentos sem categoria** — quantidade, valor total, 3 maiores (descrição/valor/data) → "Classificar" (`/movimentacoes`, `category=null`).
- **Duplicidades** — quantidade, confidence médio, maior valor → "Revisar" (`/duplicidades`).
- **Cartões** — percentual, valor, cartão responsável, maior categoria → "Abrir Cartão" (`/cartoes`, `card=<id>`).
- **Saldo projetado** — valor, diferença e percentual vs. período anterior → "Abrir Dashboard".

Insights positivos (severidade INFO), emitidos quando a condição correspondente está limpa: patrimônio em novo recorde, receita acima do período anterior, nenhum lançamento sem categoria, nenhuma duplicidade, regras consistentes, cartões conciliados, Health Check sem inconsistências.

Agrupamento: um único insight por tema (ex.: "6 lançamentos sem categoria"), nunca um card por ocorrência. Deduplicação por `id` estável.

O serviço continua 100% puro — recebe os dados já carregados pelo Dashboard e devolve a lista ordenada por severidade/prioridade. Nenhuma consulta nova.

## 3. Deep links (rotas com filtros)

Adicionar `validateSearch` (Zod) nas rotas alvo e fazer a página inicializar seus filtros a partir dos search params:

- `/regras` — `status: conflict | duplicate | all`; a listagem passa a ter abas/seção de Integridade e rola/posiciona no grupo indicado.
- `/movimentacoes` — `category: "null" | <uuid>`, `search`, `card`; hidrata os filtros já existentes da página.
- `/cartoes` — `card: <uuid>` para destacar/abrir o cartão.
- `/duplicidades` e `/dashboard` — sem filtro (navegação direta).

Navegação sempre via `<Link to params search>` do TanStack Router, com os valores vindos de `action_route`/`action_filters`.

## 4. Widget

`FinancialInsightsWidget.tsx` reescrito como Central de Pendências:

- **Resumo executivo** no topo: contadores 🔴 Problemas Críticos / 🟡 Pendências / 🔵 Informações (derivados no service, exibidos no widget).
- Cada card mostra título, detalhe contextual (quantidade, valor, top-3 itens quando houver) e o botão de ação com `action_label`.
- **Ações rápidas** inline quando não exigem navegação: Executar Health Check e Reprocessar regras (usando mutations já existentes).
- **Dismiss** ("marcar como lido"): persistido em `localStorage` por `id` + assinatura do estado do problema; se o problema persistir/mudar, o insight reaparece automaticamente. Nunca esconde um problema definitivamente.

## 5. Hook

`useFinancialInsights` continua apenas orquestrando: passa a injetar também cartões, faturas e o último resultado de Health Check (já carregados) no service, e expõe `summary` (contadores) e o estado de dismiss. Sem cálculo financeiro no hook.

## Detalhes técnicos

- Arquivos alterados: `src/models/Insight.ts`, `src/services/FinancialInsightsService.ts`, `src/hooks/useFinancialInsights.ts`, `src/components/dashboard/widgets/FinancialInsightsWidget.tsx`, rotas `regras.tsx`, `movimentacoes.tsx`, `cartoes.tsx`.
- Novo: `src/constants/insights.ts` (rotas/labels de ação) e `src/hooks/useInsightDismiss.ts` (persistência local).
- Nenhuma migração de banco; nenhuma regra financeira existente alterada.
- Validação final: typecheck limpo e a suíte de 22 testes passando, mais testes novos para o builder de insights (agrupamento, positivos, deep links).
