# Sprint 4.9 — Módulo Administrativo + Fundação SaaS

Status: Entregue · Escopo: identidade, acesso, auditoria e preparação de assinatura.
**Nenhuma cobrança, gateway ou integração de pagamento foi implementada.**

---

## 1. Modelo de autorização administrativa

- Papéis vivem em tabela própria (`public.user_roles`) com enum `app_role` — **nunca** em `profiles`.
- A verificação é feita no banco pela função `public.has_role(uuid, app_role)`
  (`SECURITY DEFINER`, `STABLE`, `search_path = public`), necessária para evitar
  recursão de RLS ao avaliar políticas sobre a própria tabela de papéis.
  `EXECUTE` revogado de `PUBLIC`/`anon`; liberado a `authenticated` e `service_role`.
- O frontend nunca envia "role": ele apenas consulta e reflete o que o banco autoriza.
  Um usuário comum que chamar o `AdminService` recebe listas vazias ou erro de RLS.

## 2. Tabelas criadas (migration)

| Tabela | Finalidade |
|---|---|
| `user_roles` | papéis de aplicação (`admin` / `user`) |
| `user_access` | liberação: `PENDING` / `ACTIVE` / `BLOCKED`, `granted_at`, `blocked_at`, `reason` |
| `subscriptions` | preparação: `plan`, `status`, `started_at`, `current_period_start/end`, `trial_ends_at`, `canceled_at` |
| `admin_audit_logs` | trilha administrativa: `actor_id`, `target_user_id`, `action`, `details`, `created_at` |

Enums: `app_role`, `user_access_status`, `subscription_status`.
`handle_new_user` passou a criar o registro de acesso do novo usuário como `PENDING`
(demais comportamentos preservados). Usuários já existentes foram backfillados como `ACTIVE`.

## 3. RLS aplicado

- `user_roles`, `user_access`, `subscriptions`: cada usuário lê **apenas a própria linha**;
  administradores leem e alteram todas (via `has_role`).
- `admin_audit_logs`: leitura só de administradores; inserção exige `has_role` **e** `actor_id = auth.uid()`.
- `profiles` e `workspaces`: adicionada leitura administrativa (nome, e-mail, workspace).
- Nenhuma política nova concede a administradores acesso a `movements`, `accounts`,
  `cards`, `assets`, orçamentos, metas ou fechamentos. O ADM administra **identidade e acesso**.

## 4. Telas e ações

- `/admin` (somente admins; usuário comum vê "Acesso restrito" e o menu nem exibe o item):
  - indicadores de identidade e de assinatura (somente dados reais, sem números fictícios);
  - tabela de usuários com nome, e-mail, cadastro, último acesso, workspaces, status,
    data de liberação e de bloqueio;
  - busca por nome/e-mail e filtro por Ativos / Bloqueados / Pendentes;
  - ações com confirmação: **Liberar acesso**, **Bloquear acesso**, **conceder/remover admin**;
  - aba de **Auditoria administrativa**.
- `AccessGate`: usuários `PENDING`/`BLOCKED` veem uma tela informativa em vez das áreas
  protegidas. Bloqueio **não** exclui nada — dados e histórico permanecem intactos.

## 5. Último acesso

O app não tem acesso à base de identidade (`auth.users`), então `último acesso` é exibido
como "—". Para popular esse dado no futuro: registrar o carimbo de login em `user_access`
(ex.: `last_seen_at`) a partir de um evento de sessão.

## 6. Preparação para assinatura — feito x pendente

Feito nesta sprint: modelo `subscriptions` + status/período/trial/cancelamento, RLS,
indicadores agregados na área administrativa e leitura pelo `AdminService`.

Pendente para sprint futura: telas de plano, mudança de plano pelo admin, regra de
bloqueio automático por inadimplência (hoje o bloqueio é manual via `user_access`),
webhooks e qualquer gateway de cobrança.

## 7. Diagnóstico das pendências antigas (Bloco 7 — nada implementado aqui)

| # | Item | Estado |
|---|---|---|
| 1 | Extrato da conta com filtros | **Parcial** — não há página de extrato por conta; existe deep link do card da conta para `/movimentacoes` com filtro |
| 2 | Ordenação A–Z das Movimentações | **Resolvido** — ordenação por coluna (inclusive texto) na página de Movimentações |
| 3 | Pesquisa de categorias incluindo subcategorias | **Resolvido** — a busca em `/categorias` também casa subcategorias |
| 4 | Transferências entre contas próprias | **Resolvido** — `transfer_group_id`, `ReconciliationService`, página de Transferências Pendentes |
| 5 | Cartão → fatura → movimentação → pagamento | **Resolvido** — `card_invoices`, recomputação automática por trigger, vínculo `invoice_id` |
| 6 | Compras de cartão não misturadas com conta | **Resolvido** — compra de cartão nasce `PENDING` sem afetar saldo de conta |
| 7 | Reconciliação de transferências | **Resolvido** — sugestão e pareamento na página dedicada |
| 8 | Fluxo de pagamento de fatura | **Resolvido** — `CARD_PAYMENT` baixa a fatura e reduz o saldo, sem criar despesa nova |
| 9 | Parcelamentos / compromissos previstos | **Pendente (UI)** — tabelas e `CommitmentService` existem; falta tela e integração com previsão de caixa |
| 10 | Revisão pós-importação | **Resolvido** — rota achatada `importacoes_.revisao.$importId` (Sprint 4.8.1) |
| 11 | Histórico de investimentos | **Resolvido** — movimentações históricas, FIFO, cadastro em lote |
| 12 | Patrimônio e dupla contagem de caixinhas | **Resolvido** — valoração efetiva por `valuation_source` evita contagem dupla |

### Prioridade recomendada

1. **Compromissos/parcelamentos (item 9)** — já existe fundação de dados; entrega previsão
   de caixa e fecha o ciclo de despesas futuras.
2. **Extrato por conta (item 1)** — página dedicada com saldo acumulado e filtros próprios.
3. Depois disso, evoluir a camada SaaS (planos e cobrança).

## 8. Testes

Nova suíte `src/services/__tests__/AdminAccess.test.ts` (17 casos) cobrindo: usuário comum
sem acesso administrativo, admin reconhecido, listagem de usuários, isolamento de dados de
terceiros, liberação, bloqueio, preservação de dados, gate de áreas protegidas, auditoria
(registro, restrição de leitura, alteração de papel), não exposição financeira e filtros/busca.

Total do projeto: **152 testes** passando.
