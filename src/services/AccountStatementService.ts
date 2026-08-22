// AccountStatementService — Sprint 4.9.2
// Extrato individual por conta. NÃO cria uma segunda fonte de verdade:
// o impacto de cada movimentação sobre a conta é sempre delegado a
// MovementServiceImpl.impactOnAccount (mesma regra usada pelo Dashboard).
// Operações históricas (is_historical) têm impacto zero, transferências
// próprias debitam a origem e creditam o destino, compras de cartão não
// afetam o caixa.

import { MovementServiceImpl } from "./MovementService";
import type { Account, Movement, UUID } from "@/models";

export interface StatementRow {
  movement: Movement;
  /** Impacto assinado sobre a conta (0 para históricos/cartão). */
  impact: number;
  inflow: number;
  outflow: number;
  /** Saldo corrido após a movimentação. */
  balance: number;
}

export interface AccountStatement {
  openingBalance: number;
  closingBalance: number;
  rows: StatementRow[];
}

/** Ordena por data e, em empate, pela criação (ordem cronológica estável). */
function chronological(a: Movement, b: Movement): number {
  if (a.transaction_date !== b.transaction_date)
    return a.transaction_date < b.transaction_date ? -1 : 1;
  return (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1;
}

class AccountStatementServiceImpl {
  /** Movimentações que pertencem à conta (origem ou destino de transferência). */
  belongsToAccount(m: Movement, accountId: UUID): boolean {
    return m.account_id === accountId || m.transfer_account_id === accountId;
  }

  forAccount(movements: Movement[], accountId: UUID): Movement[] {
    return movements.filter((m) => this.belongsToAccount(m, accountId));
  }

  /**
   * Saldo da conta imediatamente ANTES da data `from`.
   * Sem `from`, devolve apenas o saldo inicial cadastrado.
   */
  openingBalance(account: Account, allMovements: Movement[], from?: string): number {
    let balance = Number(account.initial_balance) || 0;
    if (!from) return balance;
    for (const m of allMovements) {
      if (m.transaction_date >= from) continue;
      balance += MovementServiceImpl.impactOnAccount(m, account.id);
    }
    return balance;
  }

  /** Saldo atual da conta (todas as movimentações, sem recorte de período). */
  currentBalance(account: Account, allMovements: Movement[]): number {
    let balance = Number(account.initial_balance) || 0;
    for (const m of allMovements) {
      balance += MovementServiceImpl.impactOnAccount(m, account.id);
    }
    return balance;
  }

  /**
   * Monta o extrato com saldo corrido a partir de um saldo de abertura.
   * `movements` deve ser o conjunto JÁ FILTRADO exibido na tela.
   */
  build(accountId: UUID, movements: Movement[], openingBalance: number): AccountStatement {
    const ordered = [...movements].sort(chronological);
    let balance = openingBalance;
    const rows: StatementRow[] = ordered.map((movement) => {
      const impact = MovementServiceImpl.impactOnAccount(movement, accountId);
      balance += impact;
      return {
        movement,
        impact,
        inflow: impact > 0 ? impact : 0,
        outflow: impact < 0 ? -impact : 0,
        balance,
      };
    });
    return { openingBalance, closingBalance: balance, rows };
  }
}

export const AccountStatementService = new AccountStatementServiceImpl();
export { AccountStatementServiceImpl };
