// Enums do domínio Finance OS.
// Ainda não utilizados — servem de contrato para as sprints futuras.

export enum AccountType {
  CHECKING = "checking",
  SAVINGS = "savings",
  CASH = "cash",
  INVESTMENT = "investment",
  OTHER = "other",
}

export enum MovementType {
  INCOME = "income",
  EXPENSE = "expense",
  TRANSFER = "transfer",
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
