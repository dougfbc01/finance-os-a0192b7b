# Sprint 4.10 — Cadastro inteligente de ativos por ticker

## Provider
- **brapi.dev** (dados da B3), atrás do contrato `MarketDataProvider`.
- **Chave**: opcional. Variável `BRAPI_TOKEN`, configurada como secret do backend (nunca no frontend).
  - Sem a variável: o plano gratuito responde para tickers comuns; se o provider exigir credencial,
    a resposta vira `NOT_CONFIGURED` e o usuário cadastra manualmente (fluxo nunca bloqueia).

## Arquitetura
```
AssetFormDialog → TickerLookupPanel → MarketDataService (cache/normalização/duplicidade)
                                    → MarketDataProvider (contrato)
                                    → BrapiMarketDataProvider → lookupTickerFn (server) → brapi.dev
```
Trocar de provider = implementar `MarketDataProvider` e chamar `MarketDataService.setProvider`.

## Regras
- Busca **não** cria ativo: gera prévia; o usuário confirma e pode editar tudo antes de salvar.
- Ticker duplicado no workspace → "Este ativo já está cadastrado" + ação "Abrir ativo".
- Tipo é inferido só quando seguro (ACAO/BDR/FII/ETF); sufixo `11` ambíguo fica em branco.
- Cache em memória por sessão (só respostas conclusivas); chamadas concorrentes são deduplicadas.
- Timeout de 8s; erros e timeouts retornam mensagem tratada, sem cachear.

## Próximo passo preparado
`TICKER → COTAÇÃO → VALOR ATUAL → PATRIMÔNIO → RENTABILIDADE` (basta estender o provider com `quote`).
