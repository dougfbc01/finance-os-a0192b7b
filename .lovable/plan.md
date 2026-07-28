## Sprint 3.1 — Consolidação da Regra de Negócio

Escopo integralmente concentrado nas camadas existentes (Services, Hooks, Componentes). Nenhuma alteração de arquitetura.

### Parte 1 — Cartão (status e projeção)
- **Migração SQL**:
  - Ao criar uma movimentação com `card_id` (compra), forçar `status = PENDING` (default via trigger `BEFORE INSERT`).
  - Estender `recompute_card_invoice`: ao marcar fatura como `PAID`, atualizar todas as movimentações da fatura para `status = CLEARED`. Ao reabrir (não pago), reverter para `PENDING`.
  - Confirmar que trigger `movements_recompute_invoice` cobre INSERT/UPDATE/DELETE (incluindo soft-delete via `deleted_at`).
- **MovementService.create/update**: default de status para compras em cartão = `PENDING`.
- **CardInvoiceService.markPaid**: após inserir o `CARD_PAYMENT`, chama um novo passo que promove as movimentações da fatura para `CLEARED` (garantia client-side, mesmo com trigger).
- **DashboardService / PatrimonyService**: garantir que passivo do cartão soma faturas OPEN/CLOSED/OVERDUE (já ok) e KPIs "Passivo Cartões" consideram compras PENDING.

### Parte 2 — Competência e Vencimento (auto-preenchimento)
- Centralizar no `MovementService.create/update`:
  - Conta: `competence_date` e `due_date` default = `transaction_date` quando nulos.
  - Cartão (compra): `competence_date = transaction_date`; `due_date = period.due_date` (via `CardServiceImpl.computeInvoicePeriod`).
  - `CARD_PAYMENT`: `competence_date = due_date = transaction_date`.
- Manter campos editáveis no formulário — apenas preenchimento default no service quando vierem `null`.

### Parte 3 — Investimentos (fluxo em 2 passos)
- **Modelo**: adicionar sub-tipo em `MovementService` reutilizando `MovementType.INVESTMENT/DIVIDEND/INTEREST` + novo campo lógico `investment_operation` (armazenado em `tags` ou coluna dedicada — usaremos `notes`-agnóstico via `tags: ["op:APORTE|RESGATE|RENDIMENTO|AJUSTE"]` para não migrar schema agora).
- **MovementFormDialog**: quando categoria selecionada for do tipo `INVESTMENT`, exibir segunda etapa:
  1. Seletor de destino: dropdown com todos os `assets` do workspace (caixinhas/investimentos/carteiras filtrados por `asset_type`); botão "Novo ativo" abre `AssetFormDialog` inline.
  2. Seletor de operação: Aporte / Resgate / Rendimento / Ajuste.
- Salvar `asset_id` na movimentação (campo já existe). Nunca criar movimentações extras.
- `PatrimonyService` continua agregando via `assets.current_value` (nenhuma mudança).

### Parte 4 — Classificação inteligente (scan automático)
- `ClassificationRuleService`: novo método `applyToUnclassified(workspaceId, ruleId)` que:
  - Busca movimentações do workspace com `category_id IS NULL` (e não TRANSFER/CARD_PAYMENT) cuja descrição case com `text_pattern`.
  - Retorna lista de ids compatíveis (sem aplicar).
  - Método `bulkClassify(ids, {category_id, subcategory_id})` para aplicar.
- Hook `useRememberClassification` → após sucesso, dispara scan; UI mostra `AlertDialog` "Foram encontradas N movimentações compatíveis. Deseja classificá-las?". Confirmar chama `bulkClassify` e invalida caches.

### Parte 5 — Transferências (garantia)
- Auditar `DashboardService` (income/expense/cashflow/DRE/KPIs/gráficos) para garantir filtro `type !== TRANSFER` e `type !== CARD_PAYMENT` em todos os agregados de receita/despesa. Ajustar pontos faltantes.

### Parte 6 — Reprocessamento
- Página `configuracoes.tsx`: nova seção "Classificação Inteligente" com botão **"Reprocessar Regras"** que:
  - Carrega todas as regras + movimentações sem categoria.
  - Aplica `ClassificationRuleService.match` em cada uma; agrupa por regra e chama `bulkClassify`.
  - Mostra toast com total classificado; invalida caches.

### Parte 7 — Refresh automático
- Padronizar em cada hook mutation uma função `invalidateAll(qc)` que invalida:
  `movements`, `accounts`, `dashboard`, `patrimony`, `cards`, `card_invoices`, `assets`, `imports`.
- Aplicar em: `useMovements`, `useCardInvoices`, `useAssets`, `useImports`, `useReconciliation`, `useClassificationRules`, `useCards`.

### Parte 8 — Validações (checklist final)
- ✓ `MovementService.impactOnAccount` já garante que compras com `card_id` retornam 0.
- ✓ `CardInvoiceService.markPaid` cria exatamente um `CARD_PAYMENT`.
- ✓ Recompute de fatura via trigger elimina fatura zerada com compras.
- ✓ `PatrimonyService.snapshot.netWorth = totalAssets - liabilities`.
- ✓ Autopreenchimento de competência/vencimento no `MovementService`.
- ✓ `asset_id` obrigatório quando `type ∈ INVESTMENT/DIVIDEND/INTEREST` e categoria de investimento.
- ✓ Soft-delete dispara trigger → todas as telas se atualizam via `invalidateAll`.

### Detalhes técnicos (para revisão)
- Migrações SQL: 1 migration adicionando (a) trigger `BEFORE INSERT` para default de status em compras de cartão; (b) atualização da função `recompute_card_invoice` para sincronizar status das movimentações quando `PAID/OPEN`.
- Nenhum novo schema de coluna — operação de investimento gravada em `tags` (`op:APORTE` etc.) para evitar migração desnecessária.
- Nenhuma mudança em contratos públicos existentes; apenas extensões.

### Fora do escopo
- Não altera layouts, temas, rotas ou navegação.
- Não introduz relatórios/DRE novos — apenas garante filtros corretos.
- Não muda importadores.
