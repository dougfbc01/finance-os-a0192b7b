// Enums do domínio Finance OS.

export enum AccountType {
  CHECKING = "CHECKING",
  SAVINGS = "SAVINGS",
  DIGITAL = "DIGITAL",
  WALLET = "WALLET",
  BROKER = "BROKER",
  CASH = "CASH",
  INTERNATIONAL = "INTERNATIONAL",
  OTHER = "OTHER",
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.CHECKING]: "Conta Corrente",
  [AccountType.SAVINGS]: "Conta Poupança",
  [AccountType.DIGITAL]: "Conta Digital",
  [AccountType.WALLET]: "Carteira",
  [AccountType.BROKER]: "Corretora",
  [AccountType.CASH]: "Dinheiro em Espécie",
  [AccountType.INTERNATIONAL]: "Conta Internacional",
  [AccountType.OTHER]: "Outro",
};

export const ACCOUNT_TYPE_OPTIONS = Object.values(AccountType).map((v) => ({
  value: v,
  label: ACCOUNT_TYPE_LABELS[v],
}));

export enum MovementType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
  TRANSFER = "TRANSFER",
  CARD_PAYMENT = "CARD_PAYMENT",
  INVESTMENT = "INVESTMENT",
  DIVIDEND = "DIVIDEND",
  INTEREST = "INTEREST",
  FEE = "FEE",
  TAX = "TAX",
  REFUND = "REFUND",
  ADJUSTMENT = "ADJUSTMENT",
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  [MovementType.INCOME]: "Receita",
  [MovementType.EXPENSE]: "Despesa",
  [MovementType.TRANSFER]: "Transferência",
  [MovementType.CARD_PAYMENT]: "Pagamento de Cartão",
  [MovementType.INVESTMENT]: "Investimento",
  [MovementType.DIVIDEND]: "Dividendo",
  [MovementType.INTEREST]: "Juros",
  [MovementType.FEE]: "Taxa",
  [MovementType.TAX]: "Imposto",
  [MovementType.REFUND]: "Reembolso",
  [MovementType.ADJUSTMENT]: "Ajuste",
};

export const MOVEMENT_TYPE_OPTIONS = Object.values(MovementType).map((v) => ({
  value: v,
  label: MOVEMENT_TYPE_LABELS[v],
}));

// Sinal do tipo em relação ao saldo da conta principal (account_id).
// TRANSFER é tratada em cálculo separado (fluxo entre contas).
export const MOVEMENT_TYPE_SIGN: Record<MovementType, 1 | -1 | 0> = {
  [MovementType.INCOME]: 1,
  [MovementType.DIVIDEND]: 1,
  [MovementType.INTEREST]: 1,
  [MovementType.REFUND]: 1,
  [MovementType.ADJUSTMENT]: 1,
  [MovementType.EXPENSE]: -1,
  [MovementType.FEE]: -1,
  [MovementType.TAX]: -1,
  [MovementType.INVESTMENT]: -1,
  [MovementType.CARD_PAYMENT]: -1,
  [MovementType.TRANSFER]: 0,
};

// Tipos que impactam DRE (Dashboard: Receitas x Despesas do mês).
export const INCOME_TYPES: MovementType[] = [
  MovementType.INCOME,
  MovementType.DIVIDEND,
  MovementType.INTEREST,
  MovementType.REFUND,
];

export const EXPENSE_TYPES: MovementType[] = [
  MovementType.EXPENSE,
  MovementType.FEE,
  MovementType.TAX,
];

export enum CategoryType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
  TRANSFER = "TRANSFER",
  INVESTMENT = "INVESTMENT",
}

export enum MovementStatus {
  PENDING = "PENDING",
  CLEARED = "CLEARED",
  RECONCILED = "RECONCILED",
}

export const MOVEMENT_STATUS_LABELS: Record<MovementStatus, string> = {
  [MovementStatus.PENDING]: "Pendente",
  [MovementStatus.CLEARED]: "Compensada",
  [MovementStatus.RECONCILED]: "Conciliada",
};

export const MOVEMENT_STATUS_OPTIONS = Object.values(MovementStatus).map((v) => ({
  value: v,
  label: MOVEMENT_STATUS_LABELS[v],
}));

export enum CardBrand {
  VISA = "visa",
  MASTERCARD = "mastercard",
  ELO = "elo",
  AMEX = "amex",
  HIPERCARD = "hipercard",
  OTHER = "other",
}

export enum InvestmentClass {
  FIXED_INCOME = "fixed_income",
  STOCKS = "stocks",
  FUNDS = "funds",
  CRYPTO = "crypto",
  REAL_ESTATE = "real_estate",
  OTHER = "other",
}

export enum Currency {
  BRL = "BRL",
  USD = "USD",
  EUR = "EUR",
}
