import * as XLSX from "xlsx";
import { B3_REQUIRED_COLUMNS, type B3RawRow } from "@/models/B3Import";

export function parseB3Workbook(bytes: Uint8Array): B3RawRow[] {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets["Movimentação"];
  if (!worksheet) throw new Error('A aba obrigatória "Movimentação" não foi encontrada.');

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: null });
  if (!matrix.length) throw new Error('A aba "Movimentação" está vazia.');
  const headers = (matrix[0] ?? []).map((value) => String(value ?? "").trim());
  const missing = B3_REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: true, defval: null });
  if (!rows.length) throw new Error('A aba "Movimentação" não possui linhas para processar.');
  return rows.map((row) => Object.fromEntries(B3_REQUIRED_COLUMNS.map((column) => [column, row[column]])) as unknown as B3RawRow);
}