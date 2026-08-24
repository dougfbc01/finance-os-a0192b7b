# Sprint 4.11.1 — Diagnóstico da integração de cotações (BRAPI)

## Causa raiz
A brapi.dev passou a exigir credencial para praticamente todos os tickers.
Testes reais (server-side, sem token):

| Ticker | HTTP | Retorno |
|--------|------|---------|
| WEGE3 | 401 | `MISSING_TOKEN` |
| ABCB4 | 401 | `MISSING_TOKEN` |
| AGRO3 | 401 | `MISSING_TOKEN` |
| PETR4 | 200 | cotação normal (ticker de amostra do plano free) |

Não é bug de código: o fluxo `MarketDataService → BrapiMarketDataProvider → quoteTickersFn → brapi`
está correto e já converte 401/403 em `NOT_CONFIGURED`. Faltava apenas visibilidade da causa.

## O que foi feito
- `diagnoseBrapi()` (server-only) devolve status técnico traduzido:
  `OK | NOT_CONFIGURED | INVALID_TOKEN | NOT_FOUND | TIMEOUT | UNAVAILABLE`,
  com HTTP status, código do provider, ticker, preço e horário. Nunca expõe o token.
- `diagnoseMarketFn` (server function) para a UI.
- Configurações → **Integrações — Mercado / BRAPI**: status, última consulta, último
  resultado, mensagem amigável, botão "Testar conexão" (WEGE3) e teste em lote por
  tickers separados por vírgula (usa `MarketDataService.getQuotes`, com dedupe/cache).

## Secret
`BRAPI_TOKEN` — apenas backend, lido dentro do handler. Sem ele o app continua funcionando:
cadastro manual, patrimônio e custo histórico preservados; a UI mostra "Cotação indisponível".

## Fora de escopo (mantido intacto)
`AssetValuationService`, origem de valor, movimentações históricas, caixinhas ACCOUNT,
cache/staleTime, RLS.
