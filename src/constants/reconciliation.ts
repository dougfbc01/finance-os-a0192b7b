// Constantes centrais da conciliação de transferências entre contas próprias
// (Sprint 4.14). Nenhum componente React deve redefinir estes valores.

/** Janela máxima (em dias) entre a saída e a entrada de uma mesma transferência. */
export const TRANSFER_MAX_DAY_DIFF = 3;

/** Diferença de datas que ainda caracteriza confiança ALTA. */
export const TRANSFER_HIGH_DAY_DIFF = 1;

/** Tolerância de valor (centavos) para considerar o mesmo montante. */
export const TRANSFER_AMOUNT_TOLERANCE = 0.005;

/** Similaridade textual mínima para reforçar a confiança (nunca obrigatória). */
export const TRANSFER_TEXT_SIMILARITY = 0.45;

/** Palavras que sinalizam transferência entre contas nos extratos bancários. */
export const TRANSFER_KEYWORDS = [
  "pix",
  "ted",
  "doc",
  "transf",
  "transferencia",
  "transferência",
  "envio",
  "enviado",
  "recebido",
  "recebimento",
  "resgate",
  "aplicacao",
  "aplicação",
];
