# Sprint — Renda fixa nas análises: caixinha/CDB (fonte ACCOUNT) e Tesouro Direto

## Objetivo
Ativos com `valuation_source = ACCOUNT` (ex.: CDB na caixinha do Nubank) espelham o saldo de uma
conta e, por regra, não entram no total de ativos do Patrimônio (o caixa já conta). Por isso
apareciam como R$ 0,00 na Composição e ficavam fora da aba Análise. Esta sprint os inclui
**somente nas visões de Investimentos > Análise e Composição**, valorados pelo saldo da conta.

## Regras preservadas (inalteradas)
- `PatrimonyService.countableAssets` e `AssetValuationService.countsInTotal` **não mudaram**:
  ativos ACCOUNT continuam fora do total de ativos e do patrimônio líquido (sem dupla contagem).
- Nada derivado é gravado; nenhuma migration; nenhuma fórmula de saldo nova.
- Rendimento só existe quando foi conciliado (YieldReconciliationService).

## Parte A — Caixinha/CDB (ACCOUNT) na aba Análise
- `isAccountMirrorInvestment(asset)`: ACCOUNT + `account_id` + tipo em `INVESTMENT_ASSET_TYPES`
  (BANK, CASH, CAIXINHA e OUTRO continuam excluídos).
- `accountMirrorValue(asset, account, movements, date)`: reutiliza
  `YieldReconciliationServiceImpl.breakdown` e `expectedBalance` (que usam
  `MovementServiceImpl.impactOnAccount`). Valor = saldo da conta na data; capital = saldo inicial
  + aportes/transferências recebidas − resgates/enviadas; rendimento = rendimentos registrados.
- Base mensal (`investmentMonthlyBase`): uma linha por ativo espelhado/mês com referência no fim
  do mês (mês corrente = hoje), status `ACCOUNT_RECONCILED`, etiqueta de origem "Conta
  (conciliado)" e data da última conciliação.
- Capital × Mercado (`capitalVsMarketMonthly`): ativos espelhados entram com status `ACCOUNT`,
  contam como avaliados (mercado = saldo, custo = capital) e entram na cobertura.
- Rentabilidade por grupo: `summarizeInvestments` agora agrega as linhas já projetadas (em vez de
  recomputar pelos ativos), permitindo que grupos de ativos espelhados tenham rentabilidade.
- Composição atual da aba Investimentos: inclui os espelhados pelo saldo da conta, com a nota
  "Saldo espelhado da conta; já contado no caixa do Patrimônio e não soma de novo lá".
- O rendimento aparece em degrau na data da movimentação de conciliação, sem rateio nem estimativa.

## Parte B — Tesouro Direto
- Rótulo "A custo" nas visões da aba (base mensal e Composição), sem marcação a mercado.
- Diagnóstico (somente leitura, out/2026):
  - 6 ativos Tesouro cadastrados, todos `valuation_source = MOVEMENTS`, instituição Nu Invest:
    Tesouro IPCA+ 2026, Prefixado 2025, Prefixado 2026, Prefixado 2029, Selic 2026, Selic 2027.
  - Quantidades preenchidas pelas movimentações B3 (positionOf): sim, todas com quantidade e
    preço unitário nas compras/resgates.
  - Posições encerradas (resgate total): IPCA+ 2026 (+R$ 69,37 realizado), Prefixado 2025
    (+R$ 56,71), Prefixado 2026 (+R$ 62,69), Selic 2026 (+R$ 49,92).
  - Posições abertas: Prefixado 2029 (0,28 un., custo R$ 145,39) e Selic 2027 (0,08 un., custo
    R$ 932,70) — valor atual na Composição = custo (sem cotação; "A custo").
  - Nenhum rendimento registrado (Tesouro rende no preço, sem distribuições).
  - Capital líquido Tesouro (aportes − resgates): R$ 839,40 vs R$ 7.763,81 dos demais ativos →
    ≈ 9,8% do capital líquido total. O custo das posições abertas (R$ 1.078,09) supera o capital
    líquido porque os resgates realizaram lucro.

## Arquivos alterados
- `src/services/InvestmentAnalysisService.ts` — espelhados na base mensal, no comparativo e na
  composição; `summarizeInvestments` agrega linhas projetadas; `assetType` nas linhas.
- `src/hooks/useInvestmentAnalysis.ts` — escopo inclui espelhados; `accounts` como parâmetro.
- `src/components/assets/InvestmentAnalysis.tsx` — composição com espelhados, notas explicativas,
  rótulo "A custo" para Tesouro.
- `src/components/assets/InvestmentMonthlyTable.tsx` — status "Conta (conciliado)", data da última
  conciliação, rótulo "A custo" do Tesouro.
- `src/components/assets/InvestmentCapitalVsMarketChart.tsx` — nota e tooltip sobre avaliados por
  saldo de conta.
- `src/routes/_authenticated/investimentos.tsx` — passa `accounts` e `assets` à aba Análise.
- `src/services/__tests__/InvestmentAccountMirror.test.ts` — 10 testes novos.

## Validação
- 528 testes em 43 arquivos, todos aprovados.
- Typecheck (tsgo) sem erros.
- Patrimônio/Dashboard inalterados (testado: countsInTotal/filterInvestments/countableAssets).
