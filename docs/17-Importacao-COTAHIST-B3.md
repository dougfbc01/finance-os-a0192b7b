# Importação manual do histórico de cotações da B3 (COTAHIST)

- Upload manual (.zip/.txt, um por ano) na aba Investimentos > Análise → "Importar histórico B3 (arquivo)". Nunca há download/raspagem automática da B3.
- Leitura no navegador, em streaming (fflate + TextDecoder windows-1252); o arquivo não é enviado ao servidor.
- Layout oficial: TIPREG 01 (00/99 ignorados), DATA 03-10, CODNEG 13-24, TPMERC 25-27 (somente 010 à vista), PREULT 109-121 (2 decimais implícitos).
- Ticker normalizado (sufixo F removido); só ativos do usuário com ticker, a partir do mês da primeira movimentação.
- Por ativo/mês: último pregão, preço de fechamento > 0, sem ajuste por proventos.
- Gravação em `market_price_history` com `provider='B3_COTAHIST'`, pelo mesmo caminho RLS do cliente (`MarketHistoricalPriceService.store`, ignoreDuplicates em asset_id+price_date). Linhas existentes nunca são sobrescritas. Uma cotação por ativo/mês: se o mês já tiver qualquer cotação salva (qualquer provider ou dia), o preço B3 do mês não é gravado e conta como "mês já coberto"; a cobertura é revalidada no momento da gravação.
- Relatório: preços novos, meses já cobertos, ativos sem registro, meses sem pregão.
- Service: `B3QuoteHistoryImportService`; hook: `useB3QuoteHistoryImport`; diálogo: `B3QuoteHistoryImportDialog`.
- Checagem de "mês já coberto" consulta apenas o período do arquivo (01/01 do primeiro ano a 31/12 do último), no máximo 4 ativos em paralelo, com até 3 tentativas em falhas transitórias (rede, timeout, 5xx).
- Falhas são isoladas por ativo: os demais seguem e o relatório final lista ticker e mensagem real de cada falha.
- ZIP truncado/corrompido (incl. "unexpected EOF" ou entrada .txt não finalizada) gera "ZIP incompleto ou corrompido: baixe novamente ou envie o .txt". O .txt pode ser enviado direto, sem descompactação.
- Erros do backend (objetos PostgREST) são descritos por `describeError` em `BaseService` (message, código, detalhes, dica) com o nome explícito do serviço (`serviceName`).
