# Sprint 4.15E — Correção do diagnóstico de fatura

## Causa confirmada

- O CSV é convertido integralmente em linhas oficiais, inclusive pagamentos.
- O valor oficial é a soma bruta dessas linhas. Assim, uma linha negativa de pagamento abate compras e produz `-R$ 1.950,40`.
- O total do sistema soma apenas movimentos que conseguiram correspondência; por isso um lançamento faltante não entra nos `R$ 3.160,31`.
- O importador usa hoje uma regra ampla (“contém pagamento”), inadequada para o diagnóstico porque pode gerar falsos positivos.

## Implementação

1. Criar uma identificação específica de pagamento de fatura/cartão, após normalização, cobrindo “pagamento de fatura”, “pagamento recebido” quando relacionado à fatura/cartão, “fatura paga” e equivalentes. A palavra “pagamento” isolada não será suficiente.
2. Separar pagamentos durante o diagnóstico: eles não participam do matching nem do valor oficial, enquanto créditos e estornos legítimos permanecem com sinal negativo.
3. Normalizar os totais: valor oficial líquido das linhas financeiras e total líquido de todos os movimentos pertencentes à fatura selecionada, sem depender apenas dos itens já correspondidos.
4. Expor a quantidade e o valor de pagamentos identificados no arquivo, sem tratá-los como compras ou como o total da fatura.
5. Preservar o fluxo manual existente e reforçar seus testes: persistência, vínculo ao `invoiceId` da tela, releitura, recálculo e bloqueio de duplicidade.
6. Adicionar os cenários focados solicitados, executar somente testes de conciliação diretamente afetados e o typecheck.

## Limites

- Sem migrations.
- Sem alterações em importadores, classificação, transferências ou motor geral de movimentações.
- Sem suíte completa e sem build de produção.
