# Finance OS

## Documento 03 - Modelo de Dados

Versão: 1.0

Status: Aprovado

---

# 1. Objetivo

Definir o modelo de dados principal do Finance OS.

O banco deve suportar:

- controle financeiro pessoal;
- múltiplos usuários;
- contas bancárias;
- cartões;
- investimentos;
- patrimônio;
- planejamento financeiro.

---

# 2. Princípios do Banco

## Identificação

Todas as tabelas utilizarão:

UUID

como chave primária.

---

## Auditoria

Todas as tabelas principais possuirão:


id

created_at

updated_at

deleted_at


---

## Multiusuário

Todas as informações financeiras estarão vinculadas a:


workspace_id


---

# 3. Estrutura Geral


Usuário

↓

Workspace

↓

Dados Financeiros

├── Contas

├── Cartões

├── Movimentações

├── Investimentos

├── Patrimônio

└── Planejamento

---

# 4. Tabela: profiles

Representa o usuário do sistema.

Campos:


id

email

name

avatar_url

created_at

updated_at


Relacionamento:

Um usuário pode possuir vários workspaces.

---

# 5. Tabela: workspaces

Representa o ambiente financeiro.

Exemplo:

Financeiro Familiar

Campos:


id

name

owner_id

created_at

updated_at


---

# 6. Tabela: financial_institutions

Cadastro de instituições.

Exemplos:

- Nubank
- Itaú
- Santander
- Caixa
- XP

Campos:


id

name

type

logo_url

created_at


---

# 7. Tabela: accounts

Representa contas financeiras.

Exemplos:

- Conta Nubank
- Conta PJ
- Carteira
- Corretora

Campos:


id

workspace_id

institution_id

name

account_type

currency

initial_balance

active

created_at

updated_at

deleted_at


Tipos:


CHECKING

SAVINGS

BROKER

INVESTMENT

CASH

DIGITAL_WALLET


---

# 8. Tabela: cards

Representa cartões de crédito.

Campos:


id

workspace_id

account_id

name

brand

limit_amount

closing_day

due_day

created_at

updated_at

deleted_at


---

# 9. Tabela: categories

Categorias financeiras.

Exemplo:

Moradia

Alimentação

Transporte

Campos:


id

workspace_id

name

icon

color

created_at


---

# 10. Tabela: subcategories

Subcategorias financeiras.

Exemplo:

Moradia

    Condomínio

    Energia

Campos:


id

category_id

name

created_at


---

# 11. Tabela Central: movements

A principal tabela do sistema.

Toda movimentação financeira passa por ela.

Campos:


id

workspace_id

account_id

card_id

category_id

subcategory_id

type

description

amount

transaction_date

status

import_id

created_at

updated_at

deleted_at


---

# Tipos de movimentação


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

# 12. Tabela: imports

Controle dos arquivos importados.

Campos:


id

workspace_id

account_id

filename

source

status

processed_rows

created_at


---

# 13. Tabela: import_rows

Linhas originais importadas.

Objetivo:

Manter rastreabilidade.

Campos:


id

import_id

raw_data

processed

movement_id


---

# 14. Investimentos

## assets

Cadastro dos ativos.

Exemplos:

Ações

FIIs

ETFs

Tesouro

Cripto

Campos:


id

ticker

name

type

institution_id


---

## asset_transactions

Operações.

Campos:


id

workspace_id

asset_id

type

quantity

price

transaction_date


Tipos:


BUY

SELL

DIVIDEND


---

## asset_positions

Posição atual.

Campos:


id

workspace_id

asset_id

quantity

average_price

current_price

updated_at


---

# 15. Patrimônio

## patrimony_assets

Bens físicos.

Exemplos:

Carro

Imóvel

Campos:


id

workspace_id

name

type

current_value


---

## liabilities

Dívidas.

Exemplos:

Financiamento

Empréstimo

Campos:


id

workspace_id

name

original_amount

current_balance


---

# 16. Planejamento

## budgets

Orçamento mensal.

Campos:


id

workspace_id

category_id

month

year

planned_amount


---

## goals

Metas financeiras.

Exemplos:

Casa própria

Aposentadoria

Campos:


id

workspace_id

name

target_amount

current_amount

deadline


---

# 17. Relacionamentos Principais


profiles

↓

workspaces

↓

accounts

↓

movements


---


categories

↓

subcategories

↓

movements


---


assets

↓

asset_transactions

↓

asset_positions


---

# 18. Regras Importantes

## Transferências

Nunca entram como receita ou despesa.

---

## Pagamento de cartão

Nunca cria nova despesa.

---

## Investimentos

Não são despesas.

Alteram composição patrimonial.

---

# 19. Critérios de Aceite

Modelo aprovado quando:

✓ Todas entidades principais existem.

✓ Relacionamentos estão definidos.

✓ Suporta importação bancária.

✓ Suporta investimentos.

✓ Suporta patrimônio.

✓ Suporta evolução futura.

---

# Fim do Documento

Próximo:

04-Regras-de-Negocio.md
