# Sprint 4.17B — Importação histórica B3 e retorno econômico

## Objetivo
Evoluir o preview B3 para uma importação confirmada, idempotente e auditável de eventos históricos de investimento. A B3 alimentará posição e histórico; contas, cartões, receitas, despesas e transferências continuarão sendo alimentados exclusivamente pelos fluxos bancários existentes.

## Decisões confirmadas
- `COMPRA / VENDA` permanecerá pendente e não será importada automaticamente.
- Bonificação, Desdobro e Grupamento usarão `Quantidade` como variação: Crédito soma e Débito subtrai.
- Ativos não encontrados ou ambíguos ficarão pendentes; nenhum ativo será criado automaticamente.
- Posição zero nunca excluirá, arquivará ou recriará o ativo.

## Implementação

### 1. Persistência mínima e auditável
- Adicionar `B3` às origens de importação existentes.
- Criar uma tabela de itens B3 vinculada ao lote de importação, preservando linha original, fingerprint, classificação, ativo, movimento criado, status e erro.
- Aplicar permissões e isolamento por workspace; impedir duplicidade por `workspace + fingerprint` no banco.
- Reutilizar `imports`, `movements.import_id`, `movements.asset_id`, `is_historical`, `quantity`, `unit_price` e `external_ref`; não criar uma segunda estrutura de posição.
- Identificar cada execução por lote legível `B3_IMPORT_AAAA_MM_DD_XXXX` e manter todos os eventos rastreáveis ao lote.

### 2. Confirmação segura no servidor
- Manter o upload/preview autenticado e adicionar uma função autenticada de confirmação.
- Na confirmação, reler e reprocessar o arquivo no servidor; não confiar em linhas editáveis enviadas pelo navegador.
- Revalidar workspace, ativos, classificação e fingerprints imediatamente antes da gravação.
- Criar somente movimentos históricos com `account_id`, `card_id`, `invoice_id` e `transfer_account_id` nulos.
- Gravar em lotes, tratar conflitos por linha e retornar contagens de importadas, existentes, pendentes e com erro.
- Garantir idempotência tanto pela referência do movimento quanto pelo item B3 persistido.

### 3. Mapeamento dos eventos
- Compra: aquisição histórica (`APORTE`) com quantidade, preço e custo.
- Resgate e Vencimento: realização histórica (`RESGATE`) somente pela quantidade informada; nunca zerar por inferência.
- Dividendos, JCP, Rendimentos e Restituição de Capital: eventos históricos separados, sem caixa; participam da base de retorno econômico conforme sua natureza.
- Bonificação, Desdobro e Grupamento: ajuste explícito de quantidade sem alterar custo total e sem tratar o valor informado como dinheiro recebido.
- Transferências e demais eventos societários: preservar como histórico explicável, sem caixa e sem inferir compra/venda; somente alterar posição quando a classificação já for segura.
- `COMPRA / VENDA`, ativo ausente/ambíguo e evento insuficiente: pendência, sem movimento criado.

### 4. Posição e retorno econômico
- Estender a operação de investimento com ajuste de quantidade sem custo, mantendo o cálculo centralizado no serviço atual de posição.
- Preservar custo histórico nas vendas, posição zero e recompras posteriores do mesmo ativo.
- Derivar capital investido, valores realizados, rendimentos históricos, custo da posição aberta e resultado realizado no mesmo percurso cronológico usado hoje.
- Expor retorno econômico acumulado: valor atual + vendas/resgates realizados + dividendos/JCP/rendimentos − capital investido.
- Não calcular TIR, XIRR ou retorno anualizado; não somar bonificação, desdobro ou grupamento como recebimento.
- Se não houver cotação para posição aberta, não inventar valor atual nem percentual total.

### 5. Revisão e relatório
- Adicionar seleção explícita de linhas elegíveis e uma etapa final informando quantos eventos históricos serão criados.
- Exibir claramente que receitas, despesas, transferências e alterações de saldo serão zero.
- Após confirmar, mostrar importadas, já existentes, não importadas, ativos encontrados/não encontrados, eventos por tipo e erros por linha.
- Manter possíveis correspondências com lançamentos manuais apenas como aviso; nunca excluir ou alterar movimentos existentes.

### 6. Testes e homologação
- Cobrir os 36 cenários solicitados, incluindo 1.344 linhas sintéticas, os 21 tipos, idempotência, posição zero, venda total, recompra, eventos de quantidade, neutralidade de caixa e pendências.
- Cobrir o exemplo completo de retorno econômico de R$ 1.800 (18%).
- Executar somente os novos testes e os diretamente afetados, além do typecheck; não executar suíte completa nem build de produção.
- Validar na tela preview, revisão, confirmação e relatório usando uma planilha de referência equivalente.

## Limite de homologação
O Excel real de 1.344 linhas não está anexado. A entrega validará 1.344 linhas em uma planilha equivalente gerada para os testes; números reais de importadas, duplicadas, erros e ativos ausentes dependerão do envio do arquivo real.

## Fora do escopo
- Conciliação B3 ↔ banco, criação de receitas/depósitos, integração por API, sincronização automática, TIR/XIRR, exclusão de históricos antigos, criação automática de ativos e interpretação definitiva de eventos societários ambíguos.