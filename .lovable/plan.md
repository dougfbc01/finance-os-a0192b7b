# Sprint 4.17A — Preview e classificação B3

## Objetivo
Criar uma página autenticada em `/investimentos/importar-b3` que recebe o Excel da B3, processa a aba **Movimentação**, classifica as 21 modalidades, identifica tickers e ativos do workspace e exibe um preview explicável. O fluxo será estritamente somente leitura: sem confirmação, persistência ou efeitos financeiros.

## Implementação

### 1. Modelo de preview isolado
- Criar tipos próprios para produto B3, grupos, eventos normalizados, impactos, status, alertas, linhas e resumo.
- Manter os oito valores originais da planilha junto dos campos normalizados.
- Não reutilizar `PreviewRow` de movimentações, pois ele exige semântica de receita/despesa e permite commit.

### 2. Processamento autenticado no servidor
- Criar uma função autenticada que receba o arquivo XLSX codificado, valide tamanho/extensão e processe apenas a aba `Movimentação`.
- Adicionar uma biblioteca XLSX compatível com o runtime atual e confiná-la ao código de processamento.
- Validar as oito colunas explícitas, arquivo vazio, datas e números; tratar `-` e células vazias como ausência, nunca como zero.
- Consultar somente `id`, `ticker` e `name` dos ativos ativos do workspace autenticado, usando o workspace informado sob as regras existentes. Não inserir nem atualizar registros.

### 3. Serviços de domínio B3
- Implementar `B3ProductParser` para normalizar produto, extrair ticker com segurança e separar nome, preservando o texto original.
- Resolver `FOUND`, `NOT_FOUND`, `UNIDENTIFIED` e `AMBIGUOUS`; ticker duplicado no workspace será ambíguo.
- Implementar `B3ClassificationService` com mapa explícito dos 21 tipos, grupos, eventos, natureza e impactos esperados.
- Garantir que `Entrada/Saída` nunca defina sozinho receita ou despesa.
- Implementar `B3ImportService` para validar linhas, gerar observações explicáveis, resumo, contagem por evento e fingerprint determinístico intrarquivo.
- Sinalizar duplicidades sem remover linhas e sem comparar/alterar movimentos existentes nesta sprint.

### 4. Página de preview
- Adicionar acesso na página de Investimentos e a rota dedicada com metadados próprios.
- Exibir seletor/arraste de `.xlsx`, estado de processamento e aviso permanente de “somente preview”.
- Exibir resumo, distribuição dos tipos encontrados e tabela completa com todas as colunas solicitadas.
- Implementar busca e filtros por tipo B3, grupo, ticker, identificação, status e período.
- Abrir um painel lateral ao selecionar uma linha, mostrando dados originais, interpretação, impactos, status e justificativas.
- Não exibir botão de importar, confirmar ou criar ativo.

### 5. Testes e validação
- Criar fixtures XLSX em memória com a aba e colunas reais descritas.
- Cobrir os 20 cenários solicitados, incluindo os 21 tipos, campos `-`, erros estruturais, ticker/ativo, crédito não convertido em renda e duplicidade diagnóstica.
- Adicionar testes do vínculo da página e da ausência de qualquer ação de gravação.
- Executar somente os novos testes e testes diretamente afetados, além do typecheck; não executar suíte completa nem build de produção.
- Verificar a página em desktop e celular, incluindo upload, filtros, tabela e detalhe.

## Fora do escopo garantido
- Nenhuma migration.
- Nenhuma gravação em `imports`, `movements`, `assets`, contas, cartões, faturas ou patrimônio.
- Nenhuma alteração no motor existente de investimentos, importadores bancários, classificação financeira, transferências ou conciliações.
- Nenhuma integração direta ou sincronização com a B3.

## Dependência para homologação real
O Excel B3 de 1.344 linhas não está disponível nos anexos atuais. Os testes usarão arquivos XLSX equivalentes gerados em memória a partir das colunas e tipos especificados; após o envio do arquivo real, será possível confirmar a leitura integral e eventuais particularidades de formatação sem ampliar o escopo.
