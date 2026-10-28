# Roadmap

- [x] Comparativo mensal capital × mercado: projeção no fim do mês, cotações somente do mês, cobertura e comparação sobre os mesmos ativos; preservar gráficos existentes.
- [x] Integrar filtros e invalidação de cotações; 149 testes aprovados, tela autenticada com 60 meses, tabela e filtros conferidos; build automático OK, auditoria em docs/16-Comparativo-Mensal-Capital-Mercado.md.
- [ ] Encerramento formal do comparativo: aguarda resultado explícito do typecheck automático (execução manual vedada no ambiente); permanece Em Desenvolvimento para a Definition of Done.

- [x] Ajustar somente a visualização histórica: cobertura visível de cada mês usando a projeção da monthlyBase existente; preservar pontos parciais separados, completos, rentabilidade e composição.
- [x] Validar 105 testes históricos e tela autenticada sem gravações; build automático OK. Typecheck separado não executado (verificação manual vedada pelo ambiente).

- [x] Investigar salto pela base mensal real: R$ 1.060,02 em maio, R$ 4.225,94 em junho e R$ 11.123,07 em julho; novas cotações incluem 7 e 29 posições já existentes.
- [x] Separar mudanças de cobertura: patrimônio parcial em pontos independentes, completo apenas sem faltas e detalhes por ativo; cálculos e dados financeiros preservados.
- [x] Validar 107 testes históricos, tela autenticada com 12 pontos parciais e 7 grupos e filtros; typecheck e build automáticos OK.

- [x] Criar base mensal por ativo com posição histórica, data real da cotação e status, alimentando os gráficos existentes.
- [x] Validar meses sem preços, posições encerradas, eventos e gráficos: 126 testes aprovados e conferência autenticada de 2.524 registros / 55 ativos, sem gravações financeiras; build automático OK.

- [x] Corrigir evolução patrimonial diária por tipo e total consolidado usando posições e preços históricos existentes, sem totais incompletos.
- [x] Validar eventos de posição, lacunas, filtros e telas autenticadas; informar testes e verificações automáticas.

- [x] Corrigir rentabilidade histórica sem avaliação comprovada e explicar observações isoladas, sem interpolar lacunas.
- [x] Ocultar Instituição e exibir proventos acumulados por ativo e grupo, reutilizando distribuições existentes sem alterar retorno econômico.
- [x] Validar 100 testes, telas autenticadas com 55 investimentos, typecheck separado e build automático OK.

- [x] Corrigir séries históricas inválidas e explicações dos dados ausentes na Análise.
- [x] Adicionar busca, filtro por tipo e ordenação combinados na Carteira, sem mudar valores financeiros.
- [x] Executar testes focados (89 aprovados) e conferir filtros, gráficos e ordenação com dados reais; verificação automática sem erros de build.

- [x] Evoluir a análise existente com comparação por grupo, composição coerente e limitações históricas explícitas, preservando cálculos e funcionalidades.
- [x] Executar testes relacionados e conferir análise autenticada; informar arquivos, verificação de tipos e build automático.

- [x] Estabilização: auditar importações, transferências, cartões, saldos e indicadores; corrigir somente falhas confirmadas.
- [x] Validar correções com testes focados, verificação de tipos, build automático e conferência autenticada sem modificar históricos.

- [x] Investimentos: resumo por tipo com totais e retorno econômico existente; aba Análise com histórico, período, grupos e composição, sem alterar regras financeiras.
- [x] Validar agregações e séries com testes focados e conferir as telas com dados reais.

- [x] Sprint 4.15E: corrigir totais da conciliação, identificando somente pagamentos específicos de fatura/cartão sem falsos positivos.
- [x] Preservar créditos e estornos legítimos no valor oficial.
- [x] Validar criação manual, vínculo à fatura aberta, recálculo e deduplicação.
- [x] Executar testes focados e typecheck, sem suíte completa ou build.
- [x] Sprint 4.17B: confirmar e persistir eventos B3 como histórico idempotente, auditável e neutro para o caixa.
- [x] Preservar posição zero, eventos corporativos, rendimentos e base de retorno econômico acumulado.
- [x] Validar mais de 36 cenários, lote de 1.344 linhas, confirmação e relatório; executar testes focados e typecheck.
- [x] Sprint 4.17A: processar Excel B3 em preview somente leitura, com as 21 classificações explícitas.
- [x] Exibir resumo, filtros, tabela completa e detalhe explicável em `/investimentos/importar-b3`.
- [x] Validar parser, ativos do workspace, duplicidade diagnóstica e ausência de gravações.
- [x] Executar somente testes focados, typecheck e verificação visual; sem build de produção.
- [x] Sprint 4.16A: adicionar resumo da posição atual para investimentos MOVEMENTS.
- [x] Validar cálculos, ausência de cotação, ativos ACCOUNT e neutralidade no saldo.
- [x] Executar testes focados e typecheck, sem suíte completa ou build.
- [x] Corrigir somente o cálculo e a exibição do retorno econômico dos investimentos.
- [x] Exibir o retorno econômico absoluto na listagem geral sem substituir a rentabilidade da posição.
- [x] Validar dividendos, JCP, rendimentos, realizados, capital zero e consistência entre detalhe e listagem com testes focados e typecheck.
- [x] Corrigir a reconstrução de posição dos 1.291 eventos históricos B3 existentes sem reimportação ou impacto no caixa.
- [x] Reprocessar os eventos no lugar e validar IRIM11, PLAG11, QAGR11, VISC11, VILG11, XPCA11 e TORD11.
- [x] Executar testes relacionados e typecheck, preservando retorno econômico e cotações.
- [x] Corrigir somente o custo histórico dos eventos B3 reconstruídos, sem alterar quantidades ou caixa.
- [x] Reprocessar liquidações com custo e sinalizar conversões sem origem comprovada de forma idempotente.
- [x] Validar transferência, preservação, conversão, revisão e neutralidade de caixa com testes focados e typecheck.
- [x] Integrar a conciliação manual de transferências à Revisão da Importação usando o motor existente.
- [x] Restringir as sugestões ao lote aberto, sem reconciliação automática ou terceiro movimento.
- [x] Validar confirmação, rejeição, neutralidade financeira e executar testes focados e typecheck.
- [x] Cotações: última cotação salva por ativo, atualização isolada (ativo ou todos), sem cooldown temporariamente.

- [x] Evolução histórica: patrimônio parcial separado do completo, limite de período do provedor tratado e posições encerradas zeradas

## Importação manual COTAHIST B3
- [x] Service de parser/seleção/persistência, hook, diálogo na aba Análise, 10 testes, docs (docs/17)

- [x] COTAHIST: uma cotação por ativo/mês (mês já coberto por qualquer origem é ignorado; revalidado ao gravar)
- [x] Teste CommitmentReconciliation: fixture no limite da tolerância de R$ 0,01 corrigida

## Consistência dos números e rentabilidade por grupo (Análise)
- [x] Data de referência única: última cotação salva do mês em todas as visões da aba Análise
- [x] Rentabilidade por grupo sobre o conjunto avaliado, com cobertura do capital e marcador vazado < 80%
- [x] Cobertura por valor ("% do capital avaliado") e status Completo na tabela mensal
- [x] Remoção do gráfico "Evolução do patrimônio investido" (substituído pelo Capital × Mercado)
- [x] 518 testes, build OK, docs/18 e regras de negócio atualizadas
