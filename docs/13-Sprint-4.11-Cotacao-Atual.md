# Sprint 4.11 — Cotação atual e valorização dos investimentos

## Objetivo
`TICKER → COTAÇÃO ATUAL → QUANTIDADE → VALOR ATUAL → PATRIMÔNIO`, sem criar
nenhuma movimentação financeira artificial e sem persistir cotações.

## Contrato do provider
`src/models/MarketData.ts`

```ts
interface MarketDataProvider {
  name: string;
  lookup(ticker): Promise<MarketDataLookupResult>;          // Sprint 4.10 (getTickerInfo)
  getQuotes(tickers: string[]): Promise<MarketQuoteResult[]>; // Sprint 4.11
  getHistoricalPrices?(ticker, range): Promise<never>;        // reservado (próxima sprint)
}
```

`MarketQuote` normalizada: `ticker`, `price`, `currency`, `quotedAt` (ISO),
`change`, `changePercent`, `marketState`, `provider`.
Status possíveis: `FOUND | NOT_FOUND | NO_QUOTE | ERROR | NOT_CONFIGURED`.

## Endpoint
`GET https://brapi.dev/api/quote/{TICKERS}` (lote, separado por vírgula),
chamado exclusivamente server-side por `quoteTickersFn`
(`src/lib/marketData.functions.ts` → `src/lib/marketData.server.ts`),
timeout de 8s. O frontend nunca fala com a brapi.

- **Com `BRAPI_TOKEN`**: token anexado na query no servidor; consulta normal.
- **Sem token**: a consulta é tentada; se o provider exigir credencial
  (401/403) o status vira `NOT_CONFIGURED`, a UI mostra "Cotação
  indisponível" e o ativo mantém o valor da sua origem.

## Como a cotação entra no patrimônio
`MarketQuotationService.applyQuotes(effectiveAssets, quotes)` roda **depois**
do `AssetValuationService` e apenas sobrescreve `current_value`/
`effective_value` quando há cotação. Como Patrimônio, Composição,
Investimentos e widgets já consomem `current_value`, tudo passa a refletir o
valor de mercado sem mudar de contrato.

- **ACCOUNT (caixinhas)**: nunca recebem cotação; seguem espelhando o saldo da
  conta e continuam fora do total (`counts_in_total = false`) — a conta
  espelhada é removida do bucket "Contas", então não há dupla contagem.
- **MOVEMENTS**: quantidade e custo vêm da posição reconstruída
  (`positionOf`, FIFO, respeitando `is_historical`); valor de mercado =
  quantidade × cotação; `cost_basis = position.cost`.
- **MANUAL**: mantém o valor informado; só recebe cotação se tiver ticker,
  tipo negociável e quantidade > 0.
- **Sem ticker / renda fixa / tesouro / poupança / outros**: nenhuma cotação é
  inventada (`MARKET_QUOTABLE_ASSET_TYPES = ACAO, FII, ETF, BDR`).

## Valorização
`valorização = valor de mercado − custo histórico` e
`% = ((valor / custo) − 1) × 100`. É **valorização da posição**, não
rentabilidade completa: sem dividendos, taxas ou impostos.

## Cache e refresh
Cache em memória por sessão no `MarketDataService` (`quoteCache`), com
deduplicação de tickers repetidos e de chamadas concorrentes (`quoteInflight`).
`useMarketQuotes` envolve isso em uma query (`staleTime` 5 min, sem refetch em
foco/reconexão), então nenhuma renderização React dispara consulta. O botão
"Atualizar cotações" (Patrimônio e Investimentos) limpa o cache de cotações e
refaz uma única consulta em lote.

## Erros
Ticker inexistente, sem cotação, timeout, token ausente, resposta inválida e
falha de rede são tratados por ticker. Um ativo com erro não impede os demais;
erros não são cacheados; nada vira preço zero e nenhum patrimônio é zerado.

## Limitações
- Sem histórico de preços, gráfico ou rentabilidade histórica.
- Sem cache persistente/tabela de cotações.
- Cripto e fundos ainda não são cotados (contrato pronto para incluir).
- O `marketState`/timestamp são repassados do provider; não há lógica própria
  de pregão.
