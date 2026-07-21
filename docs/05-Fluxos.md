# Finance OS

## Documento 05 - Fluxos do Sistema

Versão: 1.0

Status: Aprovado

---

# 1. Objetivo

Definir os principais fluxos operacionais do Finance OS.

Este documento descreve:

- ações do usuário;
- processamento interno;
- resultado esperado.

---

# 2. Fluxo Geral do Sistema

O funcionamento principal segue:


Usuário

↓

Importação ou Cadastro

↓

Processamento

↓

Validação

↓

Movimentações

↓

Indicadores

↓

Dashboard


---

# 3. Primeiro Acesso

## Objetivo

Criar o ambiente financeiro do usuário.

---

Fluxo:


Cadastro

↓

Criação do usuário

↓

Criação do Workspace

↓

Configuração inicial

↓

Cadastro das contas


---

Ao finalizar:

Usuário possui:

- perfil;
- workspace;
- estrutura financeira inicial.

---

# 4. Cadastro de Contas

## Objetivo

Cadastrar onde o dinheiro está.

---

Fluxo:


Nova conta

↓

Selecionar instituição

↓

Definir tipo

↓

Informar saldo inicial

↓

Salvar


---

Exemplos:

- Nubank;
- Itaú;
- Carteira;
- Corretora.

---

# 5. Cadastro de Categorias

Estrutura:


Categoria

↓

Subcategoria


---

Exemplo:


Moradia

Condomínio

Energia

Internet

---

# 6. Importação CSV

## Objetivo

Permitir entrada automática dos dados bancários.

---

Fluxo:


Usuário seleciona arquivo

↓

Upload

↓

Identificação do banco

↓

Validação

↓

Processamento

↓

Verificação duplicidade

↓

Criação das movimentações


---

O sistema deve guardar:

- arquivo original;
- data da importação;
- conta relacionada;
- quantidade de registros.

---

# 7. Importação OFX

Fluxo:


Arquivo OFX

↓

Leitura dos dados

↓

Conversão

↓

Validação

↓

Movimentações


---

Campos importantes:

- data;
- valor;
- descrição;
- identificador bancário.

---

# 8. Tratamento de Duplicidade

Antes de criar uma movimentação:

Verificar:

- conta;
- data;
- valor;
- descrição.

---

Caso exista:

Não criar novamente.

---

# 9. Conciliação Automática

Objetivo:

Relacionar informações equivalentes.

---

Exemplo:

Compra cartão:

R$500

↓

Pagamento da fatura:

R$500

---

Sistema sugere:

Relacionamento.

Usuário confirma.

---

# 10. Fluxo de Cartão de Crédito

## Compra


Compra realizada

↓

Registro no cartão

↓

Criação da despesa

↓

Aparece na fatura


---

## Pagamento


Conta bancária

↓

Pagamento da fatura

↓

Baixa da dívida


---

Importante:

Pagamento não gera nova despesa.

---

# 11. Fluxo de Transferência

Exemplo:

Nubank

para

Itaú

---

Fluxo:


Conta origem

↓

Transferência

↓

Conta destino


---

Resultado:

Somente movimentação interna.

---

# 12. Fluxo de Investimentos

## Compra de ativo


Dinheiro disponível

↓

Compra do ativo

↓

Atualização da posição


---

## Venda


Ativo vendido

↓

Redução da posição

↓

Entrada financeira


---

## Dividendos


Recebimento

↓

Receita de investimento


---

# 13. Atualização Patrimonial

O sistema consolida:


Contas

Investimentos

Bens

Dívidas


---

Resultado:

Patrimônio líquido.

---

# 14. Dashboard

O dashboard deve consumir informações consolidadas.

Exibir:

## Financeiro

- saldo;
- receitas;
- despesas.

---

## Patrimonial

- patrimônio;
- investimentos;
- evolução.

---

## Planejamento

- orçamento;
- metas.

---

# 15. Fechamento Mensal

Ao final do mês:

Sistema apresenta:

- total recebido;
- total gasto;
- principais categorias;
- evolução patrimonial.

---

# 16. Exportações

Usuário poderá exportar:

- movimentações;
- relatórios;
- carteira.

Formatos:

- CSV;
- Excel.

---

# 17. Critérios de Aceite

Fluxos aprovados quando:

✓ Usuário consegue cadastrar estrutura financeira.

✓ Arquivos podem ser importados.

✓ Duplicidades são evitadas.

✓ Cartões não duplicam despesas.

✓ Transferências não alteram resultado.

✓ Dashboard reflete dados reais.

---

# Fim do Documento

Próximo:

06-Servicos.md
