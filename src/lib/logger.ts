// Logger financeiro — Sprint 3.6.
// Nenhum erro relacionado a faturas, importações, regras, ativos ou dashboard
// pode ser silenciosamente ignorado. Todo catch deve registrar aqui.

export type LogScope =
  | "invoices"
  | "imports"
  | "rules"
  | "assets"
  | "dashboard"
  | "reconciliation"
  | "health";

export interface FinanceLogEntry {
  scope: LogScope;
  context: string;
  message: string;
  at: string;
}

const buffer: FinanceLogEntry[] = [];
const MAX = 200;

export function logFinanceError(scope: LogScope, context: string, error: unknown): FinanceLogEntry {
  const message = error instanceof Error ? error.message : String(error);
  const entry: FinanceLogEntry = { scope, context, message, at: new Date().toISOString() };
  buffer.push(entry);
  if (buffer.length > MAX) buffer.shift();
  // eslint-disable-next-line no-console
  console.error(`[finance:${scope}:${context}]`, message);
  return entry;
}

export function getFinanceLog(): FinanceLogEntry[] {
  return [...buffer];
}
