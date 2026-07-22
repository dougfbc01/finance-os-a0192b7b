// Enums do domínio Finance OS.
// Ainda não utilizados — servem de contrato para as sprints futuras.

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
  INCOME = "income",
  EXPENSE = "expense",
  TRANSFER = "transfer",
}

export enum CategoryType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
  TRANSFER = "TRANSFER",
  INVESTMENT = "INVESTMENT",
}

export enum MovementStatus {
  PENDING = "pending",
  CLEARED = "cleared",
  RECONCILED = "reconciled",
}

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
