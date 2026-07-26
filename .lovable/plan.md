# Mega Sprint 3 — Plano de Execução

Escopo grande e com impacto contábil. Antes de escrever código, valide os pontos abaixo. Nenhuma refatoração; apenas mudanças aditivas + correção da regra do cartão.

## Etapa 1 — Correção contábil do cartão

**Problema atual:** compras no cartão são tratadas como `EXPENSE` na conta bancária (reduzem saldo imediatamente) e o pagamento gera `CARD_PAYMENT`, causando dupla contabilização.

**Nova regra:**
- Compras no cartão viram movimentações `EXPENSE` com `card_id` + `invoice_id` preenchidos, `account_id = NULL`. Aparecem em relatórios de despesa e alimentam passivo, **não** alteram saldo de conta.
- Somente `CARD_PAYMENT` (gerado no pagamento da fatura) altera saldo de conta e quita fatura.
- Passivo de cartões = soma das faturas em aberto + compras da fatura corrente.

**Alterações:**
- `MovementService.impactOnAccount`: se `card_id != null`, retorna 0 (não impacta conta bancária) — mesmo para `EXPENSE`.
- `DashboardService.balanceDelta`: idem — ignora movimentos vinculados a cartão para saldo bancário.
- `DashboardService`: novos derivados `totalLiabilities`, `netWorth`, `totalAssets`.
- Migração de dados: nada destrutivo; apenas garantir que compras com `card_id` já não afetem saldo por conta do novo cálculo (retroativo automaticamente).

## Etapa 2 — Patrimônio (`assets`)

**Migração:**
- Enum `asset_type` (BANK, CASH, CDB, TESOURO, LCI, LCA, DEBENTURE, ACAO, FII, ETF, BDR, CRIPTO, PREVIDENCIA, FUNDO, CAIXINHA, OUTRO).
- Tabela `assets` com todos os campos listados + RLS + GRANTs + soft delete + trigger updated_at.
- Sem seed inicial.

**Models/Services/Hooks:**
- `src/models/Asset.ts`
- `src/services/AssetService.ts` (CRUD + cálculo de valor total, rentabilidade = `current_value - acquisition_value`).
- `src/services/PatrimonyService.ts` (agregações: por classe, por instituição, patrimônio líquido combinando `assets` + saldos + passivo de cartão).
- `src/services/InvestmentService.ts` (filtra `assets` de classes de investimento; rentabilidade %).
- `src/hooks/useAssets.ts`, `usePatrimony.ts`.

**Regra Caixinhas:** classificadas como `asset_type = CAIXINHA`. Transferência Conta → Caixinha é um `TRANSFER` normal (não altera patrimônio) — no MVP a caixinha aparece como ativo manual; ajuste automático de saldo da caixinha será feito manualmente pelo usuário (documentado; integração automática fica para a etapa de importação futura).

## Etapa 3 — Dashboard Patrimonial

Nova página `/patrimonio` (substitui placeholder) com widgets:
- Patrimônio Líquido (Ativos − Passivos)
- Ativos Totais, Passivos Totais
- Patrimônio por Classe (pizza)
- Distribuição por Instituição (pizza)
- Evolução Patrimonial (últimos 6 meses — usa saldos + snapshot atual de assets, sem histórico ainda: linha simplificada baseada em cashflow + valor atual dos ativos)
- Rentabilidade (tabela por ativo)
- Cards: Caixa, Investimentos, Cartões (passivo)

Dashboard financeiro atual ganha novos KPIs: **Saldo disponível**, **Patrimônio líquido**, **Passivo de cartões** — usando `PatrimonyService`.

Rota `/investimentos` também sai do placeholder: listagem simples dos ativos das classes de investimento com quantidade, PM, valor atual, rentabilidade.

## Etapa 4 — Arquitetura de importação futura

Sem integração externa. Apenas:
- Novos tipos em `src/services/importers/types.ts`: `AssetImportRow`, `AssetImporter`.
- Stubs vazios: `B3Importer.ts`, `NubankCaixinhasImporter.ts` (retornam `NotImplemented`).
- `ImporterFactory` mapeia origens novas para os stubs.

## Etapa 5 — Regressão

Validar manualmente via preview:
- Importações Nubank conta + cartão (cartão não altera saldo).
- Pagamento de fatura reduz saldo e quita.
- Transferências entre contas continuam neutras.
- Dashboard financeiro exibe corretamente saldo × patrimônio.

## Arquivos

**Novos**
```
supabase migration: create_assets_table
src/models/Asset.ts
src/services/AssetService.ts
src/services/PatrimonyService.ts
src/services/InvestmentService.ts (reescrito de stub)
src/hooks/useAssets.ts
src/hooks/usePatrimony.ts
src/components/assets/AssetFormDialog.tsx
src/components/assets/AssetCard.tsx
src/components/dashboard/widgets/NetWorthWidget.tsx
src/components/dashboard/widgets/AssetsByClassWidget.tsx
src/components/dashboard/widgets/AssetsByInstitutionWidget.tsx
src/components/dashboard/widgets/LiabilitiesWidget.tsx
src/services/importers/B3Importer.ts (stub)
src/services/importers/NubankCaixinhasImporter.ts (stub)
```

**Alterados**
```
src/services/MovementService.ts        (impactOnAccount ignora card_id)
src/services/DashboardService.ts       (balanceDelta ignora card_id; agrega passivo/patrimônio)
src/constants/enums.ts                 (AssetType)
src/models/index.ts                    (export Asset)
src/routes/_authenticated/patrimonio.tsx      (nova página)
src/routes/_authenticated/investimentos.tsx   (nova página)
src/routes/_authenticated/dashboard.tsx       (novos KPIs)
src/services/importers/types.ts        (AssetImporter)
src/services/importers/ImporterFactory.ts
src/hooks/useDashboard.ts              (retorna passivo/patrimônio)
```

## Confirmar antes de executar

1. Compras existentes que já reduziram saldo: aceitável que o saldo "suba" automaticamente após o deploy (é a correção contábil esperada)?
2. Widget de "Evolução Patrimonial" no MVP: sem histórico de ativos, ok apresentar linha derivada apenas do cashflow + valor atual dos ativos (constante retroativo)?
3. Caixinhas neste sprint: cadastro manual como asset (`CAIXINHA`), sem sincronização automática com movimentações — apenas arquitetura pronta?
