# Correção — Valor de ativos encerrados e de ativos sem cotação (caso Tesouro)

## Problema

Para ativos com `valuation_source = MOVEMENTS`, o valor era `opening_value + delta`
(aportes − resgates integrais + rendimentos). O resgate integral inclui o lucro
realizado, que já saiu como caixa: um ativo encerrado com lucro ficava com valor
**negativo** (ex.: Tesouro IPCA+ 2026 = −69,37) e abatia o valor dos ativos
abertos do mesmo grupo. O grupo Tesouro mostrava R$ 839,40 em vez de
R$ 1.078,09 (145,39 + 932,70); a diferença era exatamente o lucro realizado de
R$ 238,69 dos quatro encerrados.

## Regra aplicada (somente aba Investimentos)

Em `InvestmentService.rows`, ativos MOVEMENTS com evidência de posição passam a
ser valorados pela **posição reconstruída (`positionOf`)**, nunca por
`opening_value + delta`:

- **Posição encerrada** (quantidade 0 após operações): valor 0 e capital 0,
  nunca negativo. `valueOrigin = "CLOSED"` (rótulo "Encerrado" na Carteira).
- **Aberto sem cotação**: valor = custo da posição (`positionOf.cost`),
  `valueOrigin = "COST"` (rótulo "A custo" na Carteira, no Resumo e na
  Composição da Análise).
- **Aberto com cotação**: valor de mercado (`market_value`), inalterado.
- **Sem nenhuma operação vinculada**: sem evidência de posição, mantém os
  valores declarados (comportamento anterior).

O **resultado realizado** (lucro/prejuízo de vendas, resgates e vencimentos) é
exposto separadamente (`InvestmentRow.realizedResult`, coluna "Resultado
realizado" no Resumo da carteira e no detalhe do ativo), **nunca somado ao valor**.

`positionOf` não foi alterado. `InvestmentService.totals` agora recebe as
movimentações (assinatura `totals(assets, movements)`); o Resumo da carteira
agrega as linhas já projetadas em vez de recalcular.

## Impacto nos consumidores (Passo 0)

`valueOf`/`effectiveAssets` (regra `opening_value + delta`) alimentam
**Patrimônio** (snapshot, por classe, composição, por instituição), **Dashboard**
(evolução do patrimônio líquido) e **Fechamentos** (totais gravados). A correção
alteraria esses totais (Tesouro: +238,69), portanto, conforme a regra da sprint,
**não foi aplicada nesses consumidores**: eles seguem com a regra anterior e os
fechamentos já gravados permanecem intocados. Divergência conhecida e intencional
entre a aba Investimentos (R$ 1.078,09) e o Patrimônio (R$ 839,40) no grupo
Tesouro.

Classes afetadas pela divergência antiga (levantamento com dados reais):
TESOURO (4 encerrados negativos), POUPANCA (1 encerrado residual), e ativos de
mercado sem cotação salva — para ativos com cotação, o valor de mercado já
sobrescrevia o delta e nada muda.

## Coerência das demais visões da aba Investimentos

- **Composição atual** e **Resumo por tipo**: somam as linhas projetadas —
  Tesouro passa a R$ 1.078,09 com "A custo".
- **Capital × Mercado** e **base mensal**: já usavam `positionOf` para capital e
  zeravam posições encerradas; permanecem coerentes (Tesouro COST_ONLY a custo).

## Validação

- 9 novos testes (`InvestmentClosedPosition.test.ts`): encerrado com lucro →
  valor/capital 0; dois abertos + um encerrado → soma só dos abertos (1.078,09)
  com realizado separado (69,37 no caso unitário); encerrado com prejuízo idem;
  `positionOf` inalterado; `valueOf`/`effectiveAssets` inalterados (consumidores
  fora da aba); aberto com cotação → mercado; sem operações → valores declarados.
- Suíte completa: 537 testes em 44 arquivos; typecheck e build OK.
- Dados reais: Tesouro = 1.078,09 (2 abertos "A custo"), realizado 238,69
  separado; 4 encerrados a 0 com realizado individual (69,37 / 56,71 / 62,69 /
  49,92).
- Sprint 4.15F: valueOf de Patrimônio/Dashboard NÃO alterado — impacto medido atinge FII (−33,60), Poupança (−50,00) e Ações (+1,12) além do Tesouro (+238,69); aguardando decisão. Faixa sem histórico hachurada e fora da comparação; leituras paginadas por data + id.
