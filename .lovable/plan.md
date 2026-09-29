# Correção do custo histórico da reconstrução B3

## Objetivo
Corrigir somente o custo histórico dos eventos B3 de posição, sem alterar quantidades, caixa, rendimentos, retorno econômico ou cotações.

## Implementação
- Manter `amount = 0` como impacto financeiro dos ajustes, mas preservar no próprio evento uma base de custo explícita quando a B3 fornecer valor/preço.
- Em `Transferência - Liquidação` com entrada e custo informado, incorporar esse custo à posição histórica; em saída, reduzir o custo proporcionalmente à quantidade.
- Em Atualização, Grupamento, Desdobro, Bonificação e Fração, alterar apenas a quantidade e conservar o custo já acumulado.
- Dar suporte a uma conversão explicitamente vinculada para transferir o custo disponível da origem ao destino sem compra ou caixa artificial.
- Quando a origem não puder ser determinada, manter custo zero e marcar `cost:INDETERMINATE` para revisão. Conforme decidido, não presumir que IRDM11 seja a origem de IRIM11.

## Reprocessamento dos dados existentes
- Atualizar idempotentemente apenas os eventos históricos B3 elegíveis, preservando suas quantidades atuais.
- Recuperar o custo das 126 liquidações de transferência que possuem preço e valor na fonte original.
- Marcar conversões/incorporações sem relação confiável como custo indeterminado, sem inventar valores.
- Não criar lançamentos bancários, compras artificiais ou novos movimentos duplicados.

## Validação
- Testar transferência com custo, atualização preservando custo, conversão vinculada transferindo custo, conversão sem custo disponível e impacto zero no caixa.
- Executar os testes relacionados e o typecheck.
- Consultar os dados após o reprocessamento e informar a contagem exata de registros alterados e sinalizados para revisão.

## Arquivos previstos
- `src/services/B3ImportCommitService.ts`
- `src/services/AssetValuationService.ts`
- `src/services/__tests__/B3ImportCommit.test.ts`
- `src/services/__tests__/InvestmentPositionSummary.test.ts`
- `roadmap.md`
- Migração idempotente de reprocessamento dos eventos históricos existentes
