# 18 — Consistência dos números e rentabilidade por grupo (Investimentos > Análise)

## Decisões

1. **Data de referência única.** Todas as visões da aba Análise (base mensal, cobertura, comparativo Capital × Mercado e rentabilidade por grupo) usam a mesma regra: a última cotação salva do ativo dentro do mês, com data <= fim do mês (mês corrente: a mais recente até hoje). Sem cotação no mês, a referência é o fim do mês e usa a última cotação anterior, sinalizada como "cotação anterior" (STALE_PRICE). Nunca preço futuro, interpolação ou custo como valor de mercado.
2. **Rentabilidade por grupo sobre o conjunto avaliado.** Por grupo e mês: (valor de mercado dos ativos avaliados − custo dos MESMOS ativos) / custo dos mesmos ativos. Não exige cobertura total. O tooltip informa a cobertura (% do capital do grupo avaliado) e o número de ativos avaliados/sem avaliação. Pontos com cobertura abaixo de `GROUP_RETURN_COVERAGE_WARNING` (0,8) aparecem com marcador vazado e aviso. Grupo sem nenhum ativo avaliado não gera ponto. A rentabilidade da posição não inclui proventos.
3. **Cobertura por valor.** A tabela mensal do comparativo mostra "% do capital avaliado" (custo dos avaliados / capital total conhecido do escopo) além das contagens. Status "Completo" = 100% do capital do escopo com valor comprovado e nenhum ativo sem histórico.
4. **Limpeza.** O gráfico "Evolução do patrimônio investido" foi removido (substituído pelo Capital × Mercado); a tabela de cobertura mensal permanece abaixo do gráfico principal. O subtítulo do comparativo esclarece que a comparação direta de ganho é entre Valor de mercado e Capital dos ativos avaliados.

## Consumidores da base mensal (Passo 0)

`investmentMonthlyBase`, `monthlyInvestmentHistory` e as visões derivadas são consumidos apenas por `useInvestmentAnalysis` e pelos componentes da aba Análise (`InvestmentAnalysis`, `InvestmentMonthlyTable`, `InvestmentCapitalVsMarketChart`). Dashboard, Fechamentos, Patrimônio e Relatórios não consomem a base mensal; nenhum consumidor fora da aba foi alterado.

## Arquivos

- `src/services/InvestmentAnalysisService.ts` — regra única de referência em `investmentMonthlyBase`; `cost` na linha mensal; `returnCoverage` e rentabilidade sobre o conjunto avaliado em `monthlyInvestmentHistory`; `coberturaCapital` e `completo` em `capitalVsMarketMonthly`; constante `GROUP_RETURN_COVERAGE_WARNING`.
- `src/services/InvestmentViewService.ts` — `historicalChartView` anexa a cobertura aos pontos; `wealthChartView` removido.
- `src/components/assets/InvestmentAnalysis.tsx` — gráfico de evolução removido; tooltip e marcadores vazados na rentabilidade; textos de limitação simplificados.
- `src/components/assets/InvestmentCapitalVsMarketChart.tsx` — subtítulo e coluna "% do capital avaliado" + status "Completo".
- `src/components/assets/InvestmentMonthlyTable.tsx` — legenda da regra de referência.
- Removido: `src/components/assets/InvestmentWealthChart.tsx`.
- Testes: `InvestmentMonthlyBase.test.ts`, `InvestmentView.test.ts`, `InvestmentCapitalVsMarket.test.ts`.

## Auditoria da entrega — 28/10/2026

- Regras afetadas: somente apresentação da aba Análise. Nenhuma regra financeira, saldo, caixa, importação ou cotação alterada; nada derivado é gravado; sem migration.
- Auditoria arquitetural: cálculos e agregações apenas em Services; hook orquestra; componentes só exibem (sem somas de valores).
- Testes: 518 aprovados em 42 arquivos (suíte completa), incluindo os novos casos: duas cotações no mês usam a última em todas as visões; grupo com ativo sem cotação calcula rentabilidade sobre os avaliados com cobertura < 100%; grupo sem nenhum avaliado não gera ponto; cobertura em % do capital.
- Build automático: `build OK`. Typecheck separado: não executado por restrição do ambiente.
- Riscos conhecidos: a mudança de referência (primeiro pregão → última cotação do mês) altera os valores exibidos nos meses em que havia mais de uma cotação salva — é a correção pretendida; preços COTAHIST continuam sem ajuste por proventos/desdobramentos; meses sem nenhuma cotação continuam usando a última anterior, sinalizados.
- Pendências: nenhuma funcional; conferência visual na conta real recomendada no próximo uso.
