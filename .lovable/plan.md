# Correção da gestão de cotações

## Objetivo
Manter a última cotação salva separadamente para cada ativo e garantir que uma consulta nunca remova ou invalide as cotações dos demais.

## Alterações
- Reaproveitar o armazenamento de preços de mercado já existente para carregar e salvar a última cotação de cada ativo, sem alterar outras linhas.
- Separar o estado/cache por ativo, preservando as cotações já carregadas quando a lista muda ou o detalhe é aberto.
- Fazer cada solicitação consultar somente o ativo escolhido; remover temporariamente o bloqueio de intervalo entre atualizações.
- Manter intactos os cálculos de patrimônio, rentabilidade, posição e retorno econômico.
- Ajustar os controles de atualização apenas onde necessário para indicar e executar a atualização isolada.

## Validação
- Testar persistência por ativo, atualização isolada e preservação das demais cotações.
- Testar abertura do detalhe sem perda de cotações.
- Confirmar que atualizações consecutivas são permitidas.
- Executar os testes relacionados, typecheck e verificar a tela autenticada.

## Detalhes técnicos
- A chave de cotação continuará isolada por workspace e ativo.
- Escritas serão idempotentes e nunca apagarão registros de outros ativos.
- Falhas do provedor manterão a última cotação salva como fallback.
