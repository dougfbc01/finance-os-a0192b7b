# Finance OS

## Documento 02 - Arquitetura do Sistema

Versão: 1.0

Status: Aprovado

---

# 1. Objetivo

Definir a arquitetura técnica do Finance OS.

Este documento estabelece:

- tecnologias utilizadas;
- organização do projeto;
- responsabilidades de cada camada;
- padrões obrigatórios de desenvolvimento.

---

# 2. Visão Geral da Arquitetura

O Finance OS seguirá uma arquitetura baseada em camadas.

Modelo:


Frontend

↓

Services

↓

Database / Supabase

↓

PostgreSQL


---

# 3. Princípio Fundamental

O sistema deve separar:

## Interface

Responsável por:

- exibir informações;
- receber ações do usuário;
- apresentar resultados.

---

## Serviços

Responsáveis por:

- regras de negócio;
- cálculos;
- validações;
- processamento.

---

## Banco de Dados

Responsável por:

- armazenamento;
- relacionamentos;
- segurança;
- histórico.

---

# 4. Tecnologias

## Frontend

Tecnologias:

- React
- TypeScript
- Tailwind CSS

Responsabilidades:

- interface;
- componentes;
- navegação;
- experiência do usuário.

---

## Backend

Tecnologia:

Supabase

Responsabilidades:

- autenticação;
- banco de dados;
- APIs;
- segurança.

---

## Banco

Tecnologia:

PostgreSQL

Responsabilidades:

- persistência;
- relacionamentos;
- consultas analíticas.

---

# 5. Estrutura de Código

Organização esperada:


src/

├── components/

├── pages/

├── services/

├── hooks/

├── utils/

├── types/

└── integrations/


---

# 6. Camada de Componentes

Componentes devem:

- possuir responsabilidade única;
- ser reutilizáveis;
- não conter regras financeiras.

---

Exemplo:

Correto:


MovementTable

recebe dados

exibe tabela


---

Incorreto:


MovementTable

calcula saldo

classifica categoria

altera banco


---

# 7. Camada de Serviços

Toda regra financeira deve existir nos serviços.

Exemplos:


MovementService

AccountService

ImportService

InvestmentService

DashboardService


---

Responsabilidades:

- validar dados;
- executar regras;
- conversar com banco.

---

# 8. Banco de Dados

O banco deve seguir:

- PostgreSQL;
- UUID como identificador;
- migrations;
- relacionamentos claros.

---

Todas as entidades principais devem possuir:


id

created_at

updated_at

deleted_at


---

# 9. Multiusuário

O sistema deve nascer preparado para múltiplos usuários.

Estrutura:


Usuário

↓

Workspace

↓

Dados financeiros


---

Todos os dados financeiros devem estar ligados ao:


workspace_id


---

# 10. Segurança

Utilizar:

Supabase Auth

e

Row Level Security (RLS)

---

Regra:

Um usuário só pode acessar dados do seu workspace.

---

# 11. Controle de Alterações

Nenhuma informação financeira deve ser apagada fisicamente.

Utilizar:

Soft Delete

Exemplo:


deleted_at = data exclusão


---

# 12. Histórico

O sistema deve manter rastreabilidade.

Registrar:

- criação;
- alteração;
- exclusão;
- importações.

---

# 13. Escalabilidade

A arquitetura deve permitir futuramente:

- aplicativo mobile;
- Open Finance;
- integrações bancárias;
- inteligência artificial;
- múltiplos usuários.

---

# 14. Regras para Desenvolvimento

Obrigatório:

✓ Reutilizar componentes.

✓ Centralizar regras em serviços.

✓ Criar migrations para alterações de banco.

✓ Evitar código duplicado.

✓ Manter documentação atualizada.

---

# 15. Critério de Aceite

A arquitetura será considerada correta quando:

✓ O frontend não possuir regras financeiras.

✓ Serviços concentrarem lógica.

✓ Banco possuir estrutura escalável.

✓ Usuários estiverem isolados por workspace.

---

# Fim do Documento

Próximo:

03-Modelo-de-Dados.md
