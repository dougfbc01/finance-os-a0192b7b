# Sprint 4.16A — Resumo de rentabilidade do investimento

## Objetivo
Adicionar ao detalhe de ativos `MOVEMENTS` uma seção objetiva de posição atual, usando exclusivamente a posição reconstruída e a cotação já disponíveis.

## Implementação
- Centralizar no `InvestmentService` a derivação do resumo: quantidade, custo histórico, preço médio, cotação, valor atual e resultado em valor/percentual.
- Calcular valor e resultado somente quando houver posição suficiente e cotação válida.
- Exibir “Cotação indisponível” sem inventar valor ou rentabilidade quando não houver cotação.
- Não aplicar o resumo de mercado a ativos `ACCOUNT`.
- Ajustar o `AssetDetailDialog` sem alterar movimentos, saldo, patrimônio, importação ou conciliação.

## Validação
- Cobrir compra única, compras múltiplas, preço médio, custo, cotação, resultado, venda/resgate, ausência de cotação e ativo `ACCOUNT`.
- Preservar teste explícito de que operação histórica não altera saldo.
- Executar apenas os testes de investimentos diretamente afetados e typecheck; não executar suíte completa nem build.
