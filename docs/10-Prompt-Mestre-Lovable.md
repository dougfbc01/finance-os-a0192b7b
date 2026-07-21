# Finance OS

## Documento 10 - Prompt Mestre Lovable

Versão: 1.0

Status: Aprovado

---

# 1. Contexto do Projeto

Você está implementando o Finance OS.

O Finance OS é uma plataforma de gestão financeira pessoal e patrimonial.

O objetivo é consolidar em um único sistema:

- contas bancárias;
- cartões;
- investimentos;
- patrimônio;
- financiamentos;
- planejamento financeiro.

---

# 2. Objetivo Principal

Criar uma aplicação que permita ao usuário ter visão completa da sua vida financeira.

O sistema deve responder:

- Quanto dinheiro tenho?
- Onde está meu dinheiro?
- Quanto gasto?
- Como meu patrimônio evolui?
- Estou próximo dos meus objetivos?

---

# 3. Princípio Principal

A maior parte dos dados deve entrar automaticamente através de arquivos bancários.

Prioridade:

1. CSV
2. OFX
3. Integrações futuras

---

# 4. Stack Obrigatória

Frontend:

- React
- TypeScript
- Tailwind CSS

Backend:

- Supabase

Banco:

- PostgreSQL

Autenticação:

- Supabase Auth

---

# 5. Arquitetura Obrigatória

Seguir:


Frontend

↓

Services

↓

Database

↓

Supabase


---

# 6. Regras de Desenvolvimento

Não criar regras financeiras dentro dos componentes.

Componentes devem:

- exibir dados;
- receber ações;
- controlar interface.

---

Services devem:

- validar;
- calcular;
- processar;
- executar regras.

---

# 7. Banco de Dados

Seguir:

03-Modelo-de-Dados.md

Não criar tabelas fora do padrão sem necessidade.

---

Todas entidades principais devem possuir:


id

created_at

updated_at

deleted_at


---

Dados financeiros devem possuir:


workspace_id


---

# 8. Entidade Central

A principal tabela financeira é:


movements


Toda movimentação deve passar por ela.

---

Tipos:


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

# 9. Regras Financeiras Obrigatórias

## Transferências

Nunca contam como:

- receita;
- despesa.

São apenas movimentação interna.

---

## Cartões

Compra:


EXPENSE


Pagamento da fatura:


CARD_PAYMENT


Nunca duplicar despesa.

---

## Investimentos

Compra de ativo não é despesa.

Representa troca de patrimônio.

---

# 10. Segurança

Implementar:

- Supabase Auth;
- Row Level Security.

Usuários somente acessam seus próprios dados.

---

# 11. Interface

Seguir:

08-Design-System.md

A aplicação deve ser:

- profissional;
- limpa;
- orientada a dados;
- responsiva.

---

# 12. Desenvolvimento por Fases

Seguir:

09-Roadmap.md

Não implementar tudo simultaneamente.

---

# 13. Primeira Sprint

Implementar somente:

## Autenticação

- cadastro;
- login;
- logout.

---

## Workspace

Criar ambiente financeiro.

---

## Contas

Cadastro:

- banco;
- tipo;
- saldo inicial.

---

## Categorias

Criar:

Categoria

↓

Subcategoria

---

# 14. Não Implementar Agora

Não criar nesta primeira fase:

- importação CSV;
- OFX;
- cartões;
- investimentos;
- IA;
- relatórios avançados.

---

# 15. Critério de Qualidade

Toda funcionalidade deve:

✓ funcionar;

✓ possuir tratamento de erro;

✓ respeitar arquitetura;

✓ evitar duplicação;

✓ permitir evolução futura.

---

# 16. Regra Final

Construir um sistema simples de evoluir.

Priorizar:

Arquitetura correta

antes de

quantidade de funcionalidades.

---

# Fim do Documento

Finance OS
