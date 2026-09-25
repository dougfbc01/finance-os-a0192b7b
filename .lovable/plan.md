# Correção da reconstrução histórica B3

## Objetivo
Corrigir a posição derivada dos 1.291 eventos B3 já importados, sem reimportar arquivos, criar movimentos, alterar caixa, cotações, schema ou retorno econômico.

## Implementação
1. Centralizar a interpretação dos eventos B3 de posição já gravados:
   - Transferência - Liquidação: aplicar a quantidade como variação, respeitando Crédito/Débito.
   - Atualização: substituir a posição pela quantidade informada naquele evento.
   - Bonificação: aumentar a quantidade sem custo ou caixa.
   - Desdobro, Grupamento e Fração: aplicar a semântica de posição do evento sem criar custo ou caixa.
   - Leilão de Fração: reduzir a posição e contabilizar somente o resultado realizado aplicável, sem criar posição.
   - Incorporação/conversão: preservar as duas pontas da transformação sem compra financeira artificial.
2. Reprocessar os movimentos existentes no lugar, recuperando quantidade e direção da linha original preservada em `b3_import_items.raw_row`; nenhum novo movimento será inserido.
3. Tornar a correção idempotente: uma nova execução produzirá exatamente a mesma posição, custo e resultado.
4. Manter dividendos, JCP, rendimentos, retorno econômico, cotações e neutralidade de caixa inalterados.

## Validação
- Conferir as 1.291 linhas históricas e informar quantas precisaram de atualização persistida.
- Validar exatamente: IRIM11 7; PLAG11 4; QAGR11 4; VISC11 2; VILG11 1; XPCA11 34; TORD11 7.
- Cobrir cada regra de posição, neutralidade de caixa, custo preservado, resultado realizado e idempotência.
- Executar somente os testes relacionados e o typecheck.

## Limites
- Nenhuma mudança de schema ou criação/exclusão de movimentos.
- Nenhuma reimportação do Excel.
- Nenhuma mudança visual ou de fluxo de caixa.
