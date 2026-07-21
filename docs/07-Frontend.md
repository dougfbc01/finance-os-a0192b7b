# Finance OS

## Documento 07 - Frontend e Experiência do Usuário

Versão: 1.0

Status: Aprovado

---

# 1. Objetivo

Definir a estrutura do frontend do Finance OS.

Este documento estabelece:

- organização das telas;
- navegação;
- componentes;
- experiência do usuário;
- padrões de interface.

---

# 2. Princípios da Interface

O Finance OS deve transmitir:

- clareza;
- controle;
- confiança;
- simplicidade.

A interface deve ser:

- profissional;
- limpa;
- responsiva;
- orientada a dados.

---

# 3. Estrutura Principal

A aplicação será organizada em:


Autenticação

↓

Dashboard

↓

Módulos Financeiros


---

# 4. Navegação Principal

Menu lateral:


Dashboard

Finanças

Movimentações

Contas

Cartões

Investimentos

Patrimônio

Planejamento

Relatórios

Configurações


---

# 5. Tela de Login

Objetivo:

Permitir acesso seguro.

Elementos:

- email;
- senha;
- recuperar senha;
- criar conta.

---

# 6. Primeiro Acesso

Após cadastro:

Usuário deve passar por configuração inicial.

Fluxo:


Criar perfil

↓

Criar workspace

↓

Cadastrar primeira conta

↓

Cadastrar categorias

↓

Acessar dashboard


---

# 7. Dashboard Principal

Será a tela inicial.

Objetivo:

Mostrar a situação financeira atual.

---

## Cards principais

Exibir:

### Patrimônio Líquido


Ativos - Passivos


---

### Saldo Atual

Todas contas.

---

### Receitas do mês

---

### Despesas do mês

---

### Investimentos

Valor atual da carteira.

---

# 8. Gráficos do Dashboard

## Evolução Patrimonial

Linha temporal:

- patrimônio;
- evolução mensal.

---

## Fluxo de Caixa

Mostrar:

- entradas;
- saídas;
- saldo.

---

## Despesas por Categoria

Gráfico:

- alimentação;
- moradia;
- transporte;
- outros.

---

## Carteira de Investimentos

Mostrar:

- distribuição;
- evolução.

---

# 9. Tela de Movimentações

Objetivo:

Ser o extrato financeiro completo.

---

Exibir:

Colunas:

- data;
- descrição;
- categoria;
- conta;
- tipo;
- valor.

---

Filtros:

- período;
- conta;
- categoria;
- tipo.

---

Ações:

- editar;
- excluir;
- classificar.

---

# 10. Tela de Contas

Objetivo:

Gerenciar locais onde o dinheiro está.

---

Exibir:

Cards:


Nubank

R$ X

Itaú

R$ X

Corretora

R$ X


---

Permitir:

- criar;
- editar;
- desativar.

---

# 11. Tela de Cartões

Objetivo:

Controlar cartões de crédito.

---

Mostrar:

- limite;
- utilizado;
- disponível;
- próxima fatura.

---

Detalhes:

- compras;
- parcelas;
- pagamentos.

---

# 12. Tela de Investimentos

Objetivo:

Controlar carteira.

---

Mostrar:

- patrimônio investido;
- rentabilidade;
- evolução.

---

Ativos:

- ações;
- FIIs;
- ETFs;
- BDRs;
- Tesouro;
- Cripto.

---

# 13. Tela de Patrimônio

Objetivo:

Controlar riqueza total.

---

Categorias:

## Ativos

- imóveis;
- veículos;
- investimentos;
- dinheiro.

---

## Passivos

- financiamentos;
- empréstimos.

---

Resultado:

Patrimônio líquido.

---

# 14. Tela de Planejamento

Objetivo:

Acompanhar objetivos.

---

Mostrar:

## Orçamento

Planejado x Realizado.

---

## Metas

Exemplo:

Casa própria:


R$200.000

██████░░░░

60%


---

# 15. Componentes Reutilizáveis

Criar componentes:


CardMetric

DataTable

ChartCard

FilterBar

ModalForm

EmptyState

LoadingState


---

# 16. Estados da Interface

Toda tela deve possuir:

## Loading

Durante carregamento.

---

## Empty State

Quando não houver dados.

---

## Error State

Quando ocorrer falha.

---

# 17. Responsividade

O sistema deve funcionar em:

- desktop;
- tablet;
- celular.

---

Prioridade:

Desktop primeiro.

---

# 18. Regras de Desenvolvimento

O frontend:

NÃO deve:

- calcular patrimônio;
- processar importações;
- alterar regras financeiras.

---

O frontend deve:

- chamar Services;
- exibir resultados;
- controlar interação.

---

# 19. Critérios de Aceite

Frontend aprovado quando:

✓ Usuário consegue navegar facilmente.

✓ Informações importantes ficam visíveis.

✓ Interface é responsiva.

✓ Componentes são reutilizáveis.

✓ Regras permanecem nos serviços.

---

# Fim do Documento

Próximo:

08-Design-System.md
