# Sprint 4.12 — Cotações diárias + fundação do histórico de preços

## Arquitetura preservada
`Asset → MarketDataService → BrapiMarketDataProvider → BRAPI`.
Nenhum provider novo, nenhuma integração paralela. O token continua exclusivo
do servidor (`src/lib/marketData.server.ts`).

## Controle de frequência (`MarketQuoteScheduleService`)
- **Automático**: no máximo 1 atualização por dia, por workspace
  (`lastAutoDate` = data local). A query só é habilitada quando a do dia ainda
  não ocorreu.
- **Manual**: o botão "Atualizar cotações" continua visível; após um sucesso
  entra em cooldown de **30 minutos** e informa o horário de liberação.
- Estado persistido em `localStorage` por workspace — carimbo de frequência,
  **não** cache de cotações. O cache/dedupe do `MarketDataService` segue igual.
- `QuoteRefreshButton` (Patrimônio e Investimentos) mostra última atualização,
  cooldown e próxima atualização automática.

## Histórico diário de preços
- `GET /api/quote/{ticker}?range=<range>&interval=1d`, server-side
  (`fetchBrapiHistorical` → `historicalPricesFn`), token só no servidor.
- Contrato: `MarketPricePoint` (ticker, date `YYYY-MM-DD`, close, OHLCV
  opcional, provider, fetchedAt) e `MarketHistoryResult` com status
  `OK | NOT_FOUND | NO_DATA | ERROR | NOT_CONFIGURED`.
- `getHistoricalPrices` agora faz parte de `MarketDataProvider`; provider sem
  suporte devolve `ERROR` tratado (nunca lança).
- Tabela `market_price_history`: RLS por workspace do owner, índice único
  `(asset_id, price_date)` e índice `(workspace_id, ticker, price_date DESC)`.
- `MarketHistoricalPriceService`: lê o armazenado, consulta o provider só
  quando o período não está coberto, faz upsert idempotente e devolve a série
  ordenada. Falha do provider com dados armazenados → devolve o armazenado.

## UI
Seção "Histórico de mercado" no detalhe do ativo (`AssetMarketHistory`):
períodos 1M / 3M / 6M / 1A / Máximo, gráfico de linha (recharts) e
estatísticas (primeira, última, maior, menor, variação no período).
A série é **exclusivamente de mercado** — não mistura custo histórico nem
movimentações.

## Garantias
- Ativos `ACCOUNT` nunca consultam a BRAPI.
- Nenhuma cotação ou ponto histórico vira movimentação.
- Erro de rede/provider não zera valores válidos: o ativo mantém o valor da
  sua origem.

## Fora de escopo (mantido)
Rentabilidade histórica completa, IR, dividendos/JCP, proventos, Tesouro,
integração B3 e qualquer outro módulo.

## Validação
215 testes passando (13 novos), typecheck limpo, build de produção OK.
