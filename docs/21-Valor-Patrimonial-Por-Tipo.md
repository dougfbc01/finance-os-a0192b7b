# Valor patrimonial por tipo e custo ausente na rentabilidade

## Regras
- **Rentabilidade por grupo:** calculada só sobre ativos avaliados **com base de custo**. Ativo sem custo (`UNKNOWN_COST`) sai do numerador e do denominador, aparece como "sem custo" na cobertura/tooltip e não apaga o grupo. O aviso "falta base de custo" continua listando os ativos. Grupo só com ativos sem custo segue sem rentabilidade.
- **Valor patrimonial por tipo (`monthlyWealthByType`):** lê a base mensal (`investmentMonthlyBase`), sem nova avaliação.
  - Faixa do tipo = ativos com valor comprovado (cotação do mês/anterior, saldo de conta "Conta (conciliado)") + renda fixa não cotável a custo de `positionOf` ("A custo").
  - Ativos cotáveis sem nenhuma cotação: faixa "Sem avaliação (a custo)".
  - Ativos sem movimentos: só no mês atual, pelo valor da Carteira ("Sem histórico de movimentos (valor atual)"); nunca projetados para trás.
  - Tooltip: valor por faixa, total, cobertura (% do capital com valor de mercado/conta) e ativos fora das faixas.
  - Alternância Empilhado/Linhas; cores por tipo (renda variável com tons distintos, ETF verde-azulado × BDR rosa; renda fixa em família azul-petróleo).
- **Fechamento:** total do último mês = Composição atual (teste `InvestmentWealthByType.test.ts`).
- `MarketQuoteStoreService.loadLatest` pagina até achar a última cotação de cada ticker (antes um limite de 2.000 linhas descartava cotações antigas, ex.: NUBR33 aparecia "A custo").

Nada é gravado; nenhum preço é estimado.
