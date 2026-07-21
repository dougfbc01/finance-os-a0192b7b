# Finance OS

## Documento 06 - Camada de Serviços

Versão: 1.0

Status: Aprovado

---

# 1. Objetivo

Definir a camada de serviços responsável pelas regras de negócio do Finance OS.

Os serviços são responsáveis por:

- processar informações;
- validar regras;
- executar operações;
- controlar integrações;
- manter o frontend simples.

---

# 2. Arquitetura dos Serviços

O fluxo obrigatório é:


Frontend

↓

Services

↓

Database

↓

Supabase


---

O frontend nunca deve:

- calcular saldo;
- classificar movimentações;
- processar arquivos;
- calcular patrimônio.

---

# 3. Estrutura dos Serviços

Criar:


services/

├── AccountService

├── MovementService

├── ImportService

├── ReconciliationService

├── CardService

├── InvestmentService

├── AssetService

├── BudgetService

├── GoalService

└── DashboardService


---

# 4. AccountService

Responsável pelas contas financeiras.

---

## Responsabilidades

- criar contas;
- editar contas;
- consultar saldos;
- consolidar informações.

---

## Funções

### createAccount()

Cria uma nova conta.

Recebe:

- nome;
- instituição;
- tipo;
- saldo inicial.

---

### updateAccount()

Atualiza dados da conta.

---

### getBalance()

Calcula saldo:


Saldo inicial

Entradas

Saídas


---

### getAccountsSummary()

Retorna resumo das contas.

---

# 5. MovementService

Serviço central do sistema.

Todas movimentações passam por ele.

---

## Responsabilidades

- criar movimentações;
- editar;
- validar;
- excluir logicamente;
- atualizar indicadores.

---

## Funções

---

## createMovement()

Cria lançamento.

Valida:

- tipo;
- valor;
- data;
- conta.

---

## updateMovement()

Permite alterar:

- descrição;
- categoria;
- valor;
- data.

---

## deleteMovement()

Nunca remove fisicamente.

Usa:


deleted_at


---

## getMovements()

Consulta movimentações com filtros:

- período;
- conta;
- categoria;
- tipo.

---

# 6. ImportService

Responsável pelas importações bancárias.

---

## Responsabilidades

- receber arquivos;
- identificar banco;
- processar dados;
- criar movimentações.

---

## Funções

---

## uploadFile()

Recebe:

- arquivo;
- conta;
- usuário.

---

## detectLayout()

Identifica:

- banco;
- formato;
- versão.

---

Exemplo:


Nubank CSV

↓

Layout Nubank


---

## processImport()

Executa:


Arquivo

↓

Linhas

↓

Validação

↓

Movimentações


---

## validateImport()

Verifica:

- campos obrigatórios;
- duplicidade;
- formato.

---

# 7. ReconciliationService

Responsável pela conciliação inteligente.

---

## Responsabilidades

- encontrar duplicidades;
- detectar transferências;
- relacionar pagamentos.

---

## Funções

---

## detectDuplicate()

Analisa:

- data;
- valor;
- descrição;
- conta.

---

## detectTransfer()

Exemplo:

Nubank:

-1000

Itaú:

+1000

Resultado:

TRANSFER.

---

## detectCardPayment()

Relaciona:

Compra

com

Pagamento da fatura.

---

# 8. CardService

Responsável pelos cartões.

---

## Responsabilidades

- compras;
- faturas;
- vencimentos;
- pagamentos.

---

## Funções

---

## createPurchase()

Cria compra no cartão.

Tipo:


EXPENSE


---

## calculateInvoice()

Calcula:

- compras;
- saldo da fatura.

---

## payInvoice()

Registra pagamento.

Tipo:


CARD_PAYMENT


Nunca:

EXPENSE.

---

# 9. InvestmentService

Responsável pela carteira.

---

## Responsabilidades

- compras;
- vendas;
- dividendos;
- rentabilidade.

---

## Funções

---

## buyAsset()

Registra compra.

---

## sellAsset()

Registra venda.

---

## registerDividend()

Registra dividendos.

Tipo:


DIVIDEND


---

## calculatePerformance()

Calcula:

- valor investido;
- valor atual;
- lucro;
- percentual.

---

# 10. AssetService

Responsável pelos bens e patrimônio.

---

## Funções

---

## createAsset()

Exemplos:

- veículo;
- imóvel.

---

## updateValue()

Atualiza valor.

---

## calculateNetWorth()

Calcula:


Ativos - Passivos


---

# 11. BudgetService

Responsável pelo orçamento.

---

Funções:

createBudget()

updateBudget()

calculateExecution()

---

Retorna:

- planejado;
- realizado;
- diferença.

---

# 12. GoalService

Responsável pelas metas.

---

Funções:

createGoal()

updateProgress()

calculatePercentage()

---

# 13. DashboardService

Responsável pelos indicadores.

---

Funções:

## getSummary()

Retorna:

- saldo;
- receitas;
- despesas;
- patrimônio.

---

## getCashFlow()

Retorna evolução mensal.

---

## getInvestmentSummary()

Retorna carteira.

---

# 14. Regras Obrigatórias

Todos os serviços devem:

✓ Validar entradas.

✓ Tratar erros.

✓ Retornar mensagens claras.

✓ Registrar alterações importantes.

✓ Utilizar banco através de camada organizada.

---

# 15. Critérios de Aceite

A arquitetura será considerada correta quando:

✓ Frontend não possuir regras financeiras.

✓ Serviços concentrarem lógica.

✓ Código puder crescer sem retrabalho.

✓ Novos módulos puderem ser adicionados.

---

# Fim do Documento

Próximo:

07-Frontend.md
