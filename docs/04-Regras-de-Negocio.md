# Finance OS

## Documento 04 - Regras de Negócio

Versão: 1.0

Status: Aprovado

---

# 1. Objetivo

Definir as regras que controlam o comportamento financeiro do sistema.

Este documento deve orientar:

- desenvolvimento;
- validações;
- automações;
- processamento de dados;
- testes.

---

# 2. Princípios Fundamentais

## Regra 001 - Dados importados são prioridade

A maior parte das informações deve vir automaticamente dos bancos.

Fontes:

- CSV;
- OFX;
- integrações futuras.

O usuário deve evitar lançamentos manuais.

---

# Regra 002 - Usuário sempre pode corrigir

Nenhuma classificação automática deve ser definitiva.

O usuário pode:

- editar;
- alterar categoria;
- corrigir descrição;
- excluir logicamente.

---

# 3. Movimentações Financeiras

A tabela principal do sistema é:


movements


Toda movimentação financeira deve passar por ela.

---

# Regra 003 - Toda movimentação possui um tipo

Nunca controlar apenas pelo sinal do valor.

Exemplo incorreto:


-150


Exemplo correto:


amount = 150

type = EXPENSE


---

# Tipos aceitos:


INCOME

EXPENSE

TRANSFER

CARD_PAYMENT

INVESTMENT

DIVIDEND

INTEREST

FEE

TAX

REFUND

ADJUSTMENT


---

# 4. Receitas

Receitas representam entrada real de recursos.

Exemplos:

- salário;
- recebimentos;
- dividendos;
- juros.

Devem:

- aumentar saldo;
- impactar fluxo de caixa.

Tipo:


INCOME


---

# 5. Despesas

Despesas representam consumo de recursos.

Exemplos:

- supermercado;
- energia;
- combustível;
- aluguel.

Devem:

- reduzir saldo;
- possuir categoria.

Tipo:


EXPENSE


---

# 6. Transferências

## Regra 006 - Transferências não são receitas nem despesas

Exemplo:

Conta Nubank

↓

R$1.000

↓

Conta Itaú

Resultado:

Nubank:

-1000

Itaú:

+1000

Patrimônio:

sem alteração.

Tipo:


TRANSFER


---

# 7. Cartões de Crédito

## Regra 007 - Compra no cartão

Uma compra realizada no cartão deve criar uma despesa.

Exemplo:

Compra Mercado Livre

R$500

Cartão Nubank

Resultado:


EXPENSE


Associado ao cartão.

---

# Regra 008 - Pagamento da fatura

O pagamento da fatura nunca deve gerar uma nova despesa.

Fluxo:

Compra:

Cartão

↓

Despesa registrada

↓

Pagamento:

Conta bancária

↓

Quitação da dívida

Tipo:


CARD_PAYMENT


---

# 8. Importações

## Regra 009

Toda importação deve registrar:

- arquivo;
- origem;
- data;
- conta;
- quantidade de registros.

---

# Regra 010 - Duplicidade

Antes de criar uma movimentação, verificar duplicidade.

Critérios:

- data;
- valor;
- descrição;
- conta.

---

Se encontrada:

Não criar novamente.

---

# 9. Classificação Automática

O sistema deve possuir regras inteligentes.

Exemplo:

Descrição:


UBER TRIP


Categoria:


Transporte


---

Descrição:


NETFLIX


Categoria:


Lazer


---

# Regra 011 - Aprendizado

Quando o usuário corrigir uma classificação, o sistema deve usar essa informação para futuras sugestões.

---

# 10. Investimentos

## Regra 012

Investimentos não são despesas.

Exemplo:

Compra de ação:

R$1.000

Não deve aparecer como gasto.

Apenas altera a composição patrimonial.

Tipo:


INVESTMENT


---

# Regra 013 - Venda de ativos

Venda:

Reduz posição do ativo.

Aumenta saldo financeiro.

---

# Regra 014 - Dividendos

Dividendos são receitas.

Tipo:


DIVIDEND


---

# 11. Patrimônio

O patrimônio líquido deve ser:


Ativos - Passivos


---

Ativos:

- dinheiro;
- investimentos;
- imóveis;
- veículos.

Passivos:

- financiamentos;
- empréstimos;
- dívidas.

---

# Regra 015 - Veículos financiados

Exemplo:

Carro:

Valor atual:

R$70.000

Financiamento:

R$45.000

Patrimônio:

R$25.000

---

# 12. Orçamento

Comparar:


Planejado

versus

Realizado


---

Exemplo:

Moradia

Planejado:

R$2.000

Real:

R$2.300

Diferença:

-R$300

---

# 13. Metas Financeiras

Permitir acompanhar objetivos.

Exemplos:

- casa própria;
- aposentadoria;
- reserva.

---

Cálculo:


Valor atual / Valor objetivo


---

# 14. Auditoria

Alterações importantes devem ser rastreadas.

Registrar:

- usuário;
- data;
- ação;
- valor anterior;
- valor novo.

---

# 15. Segurança

Usuários só podem acessar dados do próprio workspace.

Utilizar:

Supabase Auth

+

Row Level Security

---

# 16. Critérios de Aceite

O sistema será considerado correto quando:

✓ Não duplicar pagamentos de cartão.

✓ Não considerar transferências como despesas.

✓ Investimentos não reduzirem patrimônio.

✓ Importações forem rastreáveis.

✓ Usuário conseguir corrigir informações.

---

# Fim do Documento

Próximo:

05-Fluxos.md
