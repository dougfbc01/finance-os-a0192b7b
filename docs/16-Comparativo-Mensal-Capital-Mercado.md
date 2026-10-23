# Comparativo mensal — Capital investido × Valor de mercado

## Fonte e regras
- Projeção somente leitura `capitalVsMarketMonthly` em `InvestmentAnalysisService`, sem tabela ou migration.
- Entradas: ativos e movimentos existentes e preços de `market_price_history`, obtidos pelo histórico salvo da aba Análise.
- Capital: `AssetValuationServiceImpl.positionOf` com movimentos ativos até o fim do mês; mês corrente usa hoje. Guard de evidência histórica compartilhado com `investmentHistory`, sem alterar sua regra.
- Mercado: somente tipos de `isMarketQuotableType` com ticker e última cotação positiva, finita, salva dentro do mesmo mês até a referência. `MarketQuotationServiceImpl.applyQuotes` calcula a avaliação; nunca custo como preço, preço futuro ou de outro mês.
- `MARKET`: posição avaliada; `COST_ONLY`: posição conhecida sem avaliação elegível; `NO_HISTORY`: histórico insuficiente, excluído do capital e contado no aviso.
- Capital total inclui MARKET e COST_ONLY. Ganho/perda não realizado compara exclusivamente o mercado e o custo dos mesmos MARKET. Percentual indisponível se custo avaliado for zero; mês sem avaliação mantém mercado indisponível, posição encerrada comprovada vale zero.
- Totais separados por moeda. Cobertura conta posições conhecidas em aberto; ativos sem histórico têm aviso separado, não quantidade presumida.

## Integração
`useInvestmentAnalysis` expõe a projeção pelos mesmos ativos, movimentos, grupo, moeda e período. Análise começa em Desde o início. `InvestmentCapitalVsMarketChart` fica acima dos gráficos existentes e exibe três séries, tooltip e tabela recolhível.

Movimentações atualizam pela invalidação financeira existente e dependências da projeção. Cotações atuais/históricas salvas invalidam `investment-analysis-prices`; leitura desse histórico não consulta o provedor. Busca mensal continua ação explícita.

## Preservação e limites
`positionOf`, `investmentMonthlyBase`, `monthlyInvestmentHistory`, evolução anterior, rentabilidade, tabela mensal e composição vigente permanecem com as mesmas regras. Não há escrita financeira nem novos provedores ou serviços. Ativos manuais, espelhados, com saldo inicial ou evidência insuficiente continuam NO_HISTORY; custos indeterminados não são reparados por esta projeção. Uma cotação do mês pode preceder o fim do mês: é a última evidência salva, não um preço de fechamento inferido.

## Validação
Testes em `InvestmentCapitalVsMarket.test.ts`: compras intermediárias, preço médio, venda parcial, ausência de preço no mês, renda fixa/ticker ausente, posições encerradas, histórico insuficiente, moedas, data corrente, soma das linhas, igualdade com positionOf, capital zero e ajustes corporativos. Testes históricos anteriores protegem os gráficos existentes.

## Auditoria da entrega — 23/10/2026
- Criados: `src/components/assets/InvestmentCapitalVsMarketChart.tsx`, `src/services/__tests__/InvestmentCapitalVsMarket.test.ts` e este documento.
- Alterados: `InvestmentAnalysisService.ts` (projeção e extração equivalente do guard existente), `useInvestmentAnalysis.ts` (exposição), `InvestmentAnalysis.tsx` (integração e MAX inicial), `useMarketQuotes.ts` e `useMarketPriceHistory.ts` (invalidação após cotações), `AGENTS.md` e `roadmap.md`.
- Migrations, tabelas, rotas, positionOf e dados financeiros: nenhuma alteração.
- Auditoria arquitetural: cálculos e agregações apenas no service; hook orquestra; componente apresenta. Reuso de posição, guard e cotação; entradas imutáveis testadas; gráficos anteriores protegidos pelos testes existentes.
- 149 testes aprovados em 10 arquivos: comparativo, base mensal, análise, view, resumo de posição, cotações, armazenamento de preços, cotações mensais, investimentos históricos e intervalo do provedor.
- Conferência autenticada em `/investimentos`: 55 investimentos, período inicial Desde o início, 60 meses na tabela (novembro/2021 a outubro/2026), filtro Ações e 3 meses (4 referências mensais), gráfico/tabela visíveis e zero erros de página. Capturas desktop conferidas. Não foram gravados movimentos nem solicitadas cotações para a conferência.
- Atualização por movimentos: dependências e invalidação existentes preservadas; atualização após cotações: invalidação da consulta de preços adicionada. Escritas financeiras e consultas ao provedor não exercitadas na conta para não alterar dados; caminhos auditados no código.
- Build automático: último resultado observado `build OK`. Typecheck separado: não executado por restrição do ambiente; resultado automático explícito não disponível no log. Encerramento formal aguarda esse sinal; status Em Desenvolvimento na Definition of Done.
- Riscos conhecidos: cobertura de preços continua limitada ao histórico salvo; mercado parcial não é carteira inteira; posições sem evidência não são reparadas. Linhas de mercado/custo avaliado acompanham uma cobertura variável, explicitada na tabela e tooltip; a diferença usa somente ativos idênticos avaliados. Sem mudança nos pontos desconectados da evolução anterior.