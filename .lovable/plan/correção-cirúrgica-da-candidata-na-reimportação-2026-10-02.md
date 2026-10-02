# Correção cirúrgica da candidata na reimportação

## Alteração
- Manter o fluxo normal e o motor de correspondência intactos.
- Dentro de `listCandidatesForImport()`, acrescentar uma busca complementar entre movimentos da importação aberta e uma perna de transferência já existente.
- Reutilizar `findCandidates()` com uma representação temporária da direção da perna existente, respeitando conta de destino, valor, data, decisões manuais e exclusões atuais.
- Não sugerir uma terceira perna quando o grupo existente já estiver completo.

## Validação
- Cobrir por testes a candidata de reimportação, o destino correto, decisões rejeitadas e grupos completos.
- Executar apenas os testes de reconciliação e o typecheck.
- Não alterar pacotes, dependências, banco ou roadmap.
