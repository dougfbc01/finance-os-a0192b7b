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

export enum CardInvoiceStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
}

export const CARD_INVOICE_STATUS_LABELS: Record<CardInvoiceStatus, string> = {
  [CardInvoiceStatus.OPEN]: "Aberta",
  [CardInvoiceStatus.CLOSED]: "Fechada",
  [CardInvoiceStatus.PAID]: "Paga",
  [CardInvoiceStatus.OVERDUE]: "Atrasada",
};

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

// -----------------------------------------------------------------------------
// Patrimônio / Ativos
// -----------------------------------------------------------------------------
export enum AssetType {
  BANK = "BANK",
  CASH = "CASH",
  POUPANCA = "POUPANCA",
  RENDA_FIXA = "RENDA_FIXA",
  CDB = "CDB",
  TESOURO = "TESOURO",
  LCI = "LCI",
  LCA = "LCA",
  DEBENTURE = "DEBENTURE",
  ACAO = "ACAO",
  FII = "FII",
  ETF = "ETF",
  BDR = "BDR",
  CRIPTO = "CRIPTO",
  PREVIDENCIA = "PREVIDENCIA",
  FUNDO = "FUNDO",
  CAIXINHA = "CAIXINHA",
  OUTRO = "OUTRO",
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  [AssetType.BANK]: "Conta Bancária",
  [AssetType.CASH]: "Dinheiro",
  [AssetType.POUPANCA]: "Poupança",
  [AssetType.RENDA_FIXA]: "Renda Fixa (outros)",
  [AssetType.CDB]: "CDB",
  [AssetType.TESOURO]: "Tesouro Direto",
  [AssetType.LCI]: "LCI",
  [AssetType.LCA]: "LCA",
  [AssetType.DEBENTURE]: "Debêntures",
  [AssetType.ACAO]: "Ações",
  [AssetType.FII]: "FIIs",
  [AssetType.ETF]: "ETFs",
  [AssetType.BDR]: "BDRs",
  [AssetType.CRIPTO]: "Criptomoedas",
  [AssetType.PREVIDENCIA]: "Previdência",
  [AssetType.FUNDO]: "Fundos",
  [AssetType.CAIXINHA]: "Caixinha",
  [AssetType.OUTRO]: "Outro",
};

export const ASSET_TYPE_OPTIONS = Object.values(AssetType).map((v) => ({
  value: v,
  label: ASSET_TYPE_LABELS[v],
}));

/**
 * Sprint 4.6 — características do tipo de ativo.
 * Define quais campos fazem sentido no cadastro (nada é obrigatório à força).
 */
export interface AssetTypeTraits {
  /** Quantidade e preço médio são relevantes (ativos negociados em cotas). */
  hasQuantity: boolean;
  /** Código de negociação (ticker) é relevante. */
  hasTicker: boolean;
}

const QUOTED_TYPES: AssetType[] = [
  AssetType.ACAO,
  AssetType.FII,
  AssetType.ETF,
  AssetType.BDR,
  AssetType.CRIPTO,
  AssetType.FUNDO,
];

export function assetTypeTraits(t: AssetType): AssetTypeTraits {
  const quoted = QUOTED_TYPES.includes(t);
  return {
    hasQuantity: quoted || t === AssetType.TESOURO,
    hasTicker: quoted,
  };
}


/** Classes que aparecem no dashboard de investimentos (exclui BANK/CASH/CAIXINHA/OUTRO). */
export const INVESTMENT_ASSET_TYPES: AssetType[] = [
  AssetType.CDB, AssetType.TESOURO, AssetType.LCI, AssetType.LCA, AssetType.DEBENTURE,
  AssetType.ACAO, AssetType.FII, AssetType.ETF, AssetType.BDR, AssetType.CRIPTO,
  AssetType.PREVIDENCIA, AssetType.FUNDO,
];

export enum AssetClassGroup {
  CAIXA = "CAIXA",
  RENDA_FIXA = "RENDA_FIXA",
  RENDA_VARIAVEL = "RENDA_VARIAVEL",
  FUNDOS = "FUNDOS",
  CRIPTO = "CRIPTO",
  PREVIDENCIA = "PREVIDENCIA",
  OUTROS = "OUTROS",
}

export const ASSET_CLASS_GROUP_LABELS: Record<AssetClassGroup, string> = {
  [AssetClassGroup.CAIXA]: "Caixa",
  [AssetClassGroup.RENDA_FIXA]: "Renda Fixa",
  [AssetClassGroup.RENDA_VARIAVEL]: "Renda Variável",
  [AssetClassGroup.FUNDOS]: "Fundos",
  [AssetClassGroup.CRIPTO]: "Cripto",
  [AssetClassGroup.PREVIDENCIA]: "Previdência",
  [AssetClassGroup.OUTROS]: "Outros",
};

export function assetTypeToGroup(t: AssetType): AssetClassGroup {
  switch (t) {
    case AssetType.BANK:
    case AssetType.CASH:
    case AssetType.CAIXINHA:
      return AssetClassGroup.CAIXA;
    case AssetType.CDB:
    case AssetType.TESOURO:
    case AssetType.LCI:
    case AssetType.LCA:
    case AssetType.DEBENTURE:
      return AssetClassGroup.RENDA_FIXA;
    case AssetType.ACAO:
    case AssetType.FII:
    case AssetType.ETF:
    case AssetType.BDR:
      return AssetClassGroup.RENDA_VARIAVEL;
    case AssetType.FUNDO:
      return AssetClassGroup.FUNDOS;
    case AssetType.CRIPTO:
      return AssetClassGroup.CRIPTO;
    case AssetType.PREVIDENCIA:
      return AssetClassGroup.PREVIDENCIA;
    default:
      return AssetClassGroup.OUTROS;
  }
}

// -----------------------------------------------------------------------------
// Sprint 4.5.2 — Origem do valor patrimonial de um ativo
// -----------------------------------------------------------------------------
/**
 * MANUAL     → valor informado pelo usuário (current_value).
 * MOVEMENTS  → valor inicial + impacto das movimentações vinculadas ao ativo.
 * ACCOUNT    → espelha o saldo de uma conta financeira (caixinhas).
 *              NUNCA soma no total de ativos: o saldo já está no caixa.
 */
export enum AssetValuationSource {
  MANUAL = "MANUAL",
  MOVEMENTS = "MOVEMENTS",
  ACCOUNT = "ACCOUNT",
}

export const ASSET_VALUATION_SOURCE_LABELS: Record<AssetValuationSource, string> = {
  [AssetValuationSource.MANUAL]: "Valor informado manualmente",
  [AssetValuationSource.MOVEMENTS]: "Calculado pelas movimentações",
  [AssetValuationSource.ACCOUNT]: "Espelha o saldo de uma conta",
};

export const ASSET_VALUATION_SOURCE_OPTIONS = Object.values(AssetValuationSource).map((v) => ({
  value: v,
  label: ASSET_VALUATION_SOURCE_LABELS[v],
}));

/** Operação de investimento registrada na tag `op:` da movimentação. */
export enum InvestmentOperation {
  APORTE = "APORTE",
  RESGATE = "RESGATE",
  RENDIMENTO = "RENDIMENTO",
  AJUSTE = "AJUSTE",
}

export const INVESTMENT_OPERATION_LABELS: Record<InvestmentOperation, string> = {
  [InvestmentOperation.APORTE]: "Aporte",
  [InvestmentOperation.RESGATE]: "Resgate",
  [InvestmentOperation.RENDIMENTO]: "Rendimento",
  [InvestmentOperation.AJUSTE]: "Ajuste",
};

export const INVESTMENT_OPERATION_OPTIONS = Object.values(InvestmentOperation).map((v) => ({
  value: v,
  label: INVESTMENT_OPERATION_LABELS[v],
}));

/** Prefixo da tag que carrega a operação de investimento. */
export const INVESTMENT_OP_TAG_PREFIX = "op:";
