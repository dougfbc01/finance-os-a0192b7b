# Correção cirúrgica da reconciliação na importação

## Objetivo
Integrar a decisão manual de transferências à Revisão da Importação usando exclusivamente o motor existente, sem reconciliação automática ou terceiro lançamento.

## Alterações
- Restringir a contagem pós-importação às candidatas ligadas à importação recém-concluída.
- Manter na revisão as ações explícitas **Confirmar** e **Não relacionadas**, delegadas a `ReconciliationService.apply()` e `reject()`.
- Acrescentar testes focados para detecção no escopo da importação, ausência de ação automática, confirmação, rejeição e neutralidade financeira.
- Registrar a tarefa no roadmap, sem refatorações paralelas.

## Validação
- Executar somente os testes de importação/reconciliação relacionados.
- Executar o typecheck.
- Conferir o resultado do build automático.
