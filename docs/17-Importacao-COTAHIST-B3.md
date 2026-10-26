# Importação manual do histórico de cotações da B3 (COTAHIST)

- Upload manual (.zip/.txt, um por ano) na aba Investimentos > Análise → "Importar histórico B3 (arquivo)". Nunca há download/raspagem automática da B3.
- Leitura no navegador, em streaming (fflate + TextDecoder windows-1252); o arquivo não é enviado ao servidor.
- Layout oficial: TIPREG 01 (00/99 ignorados), DATA 03-10, CODNEG 13-24, TPMERC 25-27 (somente 010 à vista), PREULT 109-121 (2 decimais implícitos).
- Ticker normalizado (sufixo F removido); só ativos do usuário com ticker, a partir do mês da primeira movimentação.
- Por ativo/mês: último pregão, preço de fechamento > 0, sem ajuste por proventos.
- Gravação em `market_price_history` com `provider='B3_COTAHIST'`, pelo mesmo caminho RLS do cliente (`MarketHistoricalPriceService.store`, ignoreDuplicates em asset_id+price_date). Linhas existentes nunca são sobrescritas.
- Relatório: preços novos, já existentes, ativos sem registro, meses sem pregão.
- Service: `B3QuoteHistoryImportService`; hook: `useB3QuoteHistoryImport`; diálogo: `B3QuoteHistoryImportDialog`.
