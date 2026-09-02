// Sprint 4.14 — Política central da conciliação de fatura de cartão.
// Nenhum serviço/componente pode redefinir pesos, tolerâncias ou palavras-chave.
// A conciliação é DIAGNÓSTICA: estas constantes nunca alteram dados financeiros.

/** Diferença de valor (R$) considerada arredondamento e ainda MATCHED. */
export const INVOICE_AMOUNT_TOLERANCE = 0.02;

/** Diferença de datas (dias) aceita sem sinalizar divergência de data. */
export const INVOICE_DATE_TOLERANCE_DAYS = 2;

/** Acima disso a data deixa de ser sinal útil de correspondência. */
export const INVOICE_DATE_MAX_DAYS = 7;

/** Similaridade textual mínima para reforçar a correspondência. */
export const INVOICE_TEXT_SIMILARITY = 0.6;

/** Score mínimo para aceitar um candidato como correspondência. */
export const INVOICE_MATCH_MIN_SCORE = 55;

/** Score a partir do qual a correspondência é considerada forte. */
export const INVOICE_MATCH_STRONG_SCORE = 85;

/** Diferença máxima entre 1º e 2º candidatos para considerar ambíguo. */
export const INVOICE_AMBIGUITY_MARGIN = 10;

/** Pesos explicáveis do matching (somados, limitados a 100). */
export const INVOICE_MATCH_WEIGHTS = {
  EXTERNAL_REF: 100,
  SAME_INVOICE: 8,
  AMOUNT_EXACT: 40,
  AMOUNT_NEAR: 22,
  INSTALLMENT_EXACT: 18,
  DESCRIPTION_STRONG: 25,
  DESCRIPTION_PARTIAL: 12,
  DATE_EXACT: 15,
  DATE_NEAR: 10,
  DATE_FAR: 3,
  DATE_PENALTY: -12,
  DIRECTION_MISMATCH: -25,
} as const;

/** Termos que caracterizam juros, multas, IOF, tarifas e encargos. */
export const INVOICE_FEE_KEYWORDS = [
  "juros",
  "multa",
  "iof",
  "tarifa",
  "encargo",
  "encargos",
  "anuidade",
  "mora",
  "rotativo",
  "parcelamento de fatura",
  "atraso",
  "seguro",
];

/** Termos que caracterizam estorno, reembolso, crédito ou ajuste. */
export const INVOICE_REFUND_KEYWORDS = [
  "estorno",
  "estornado",
  "reembolso",
  "devolucao",
  "devolução",
  "credito de",
  "crédito de",
  "cancelamento",
  "ajuste",
  "chargeback",
];
