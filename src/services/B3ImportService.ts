import { B3ClassificationService } from "./B3ClassificationService";
import { B3ProductParser } from "./B3ProductParser";
import type { B3AssetReference, B3PreviewResult, B3RawRow, B3RowStatus } from "@/models/B3Import";

const text = (value: unknown): string | null => {
  const result = String(value ?? "").trim();
  return !result || result === "-" ? null : result;
};

const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const date = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 0) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return date(new Date(excelEpoch + Math.floor(value) * 86_400_000));
  }
  const raw = text(value);
  if (!raw) return null;
  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (match) return validDate(`${match[3]}-${match[2]}-${match[1]}`);
  match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return match ? validDate(`${match[1]}-${match[2]}-${match[3]}`) : null;
};

const validDate = (value: string): string | null => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
};

const fingerprint = (parts: Array<string | number | null>) =>
  parts.map((part) => String(part ?? "∅").trim().toUpperCase()).join("|");

export class B3ImportService {
  static buildPreview(fileName: string, rawRows: B3RawRow[], assets: B3AssetReference[]): B3PreviewResult {
    const seen = new Map<string, number>();
    const rows = rawRows.map((raw, index) => {
      const direction = text(raw["Entrada/Saída"]);
      const parsedDate = date(raw.Data);
      const movementType = text(raw.Movimentação) ?? "";
      const institution = text(raw.Instituição);
      const product = B3ProductParser.parse(text(raw.Produto) ?? "", institution, assets);
      const quantity = number(raw.Quantidade);
      const unitPrice = number(raw["Preço unitário"]);
      const operationValue = number(raw["Valor da Operação"]);
      const classification = B3ClassificationService.classify(movementType);
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!parsedDate) errors.push("Data inválida ou ausente.");
      if (!movementType) errors.push("Movimentação ausente.");
      if (!text(raw.Produto)) errors.push("Produto ausente.");
      for (const [label, original, parsed] of [
        ["Quantidade", raw.Quantidade, quantity],
        ["Preço unitário", raw["Preço unitário"], unitPrice],
        ["Valor da Operação", raw["Valor da Operação"], operationValue],
      ] as const) {
        if (text(original) !== null && parsed === null) errors.push(`${label} inválido.`);
      }
      if (classification.group === "B3_UNCLASSIFIED") warnings.push("Tipo B3 não classificado.");
      if (product.identificationStatus === "NOT_FOUND") warnings.push("Ticker identificado, mas ativo não encontrado no workspace.");
      if (product.identificationStatus === "UNIDENTIFIED") warnings.push("Ticker não identificado com segurança.");
      if (product.identificationStatus === "AMBIGUOUS") warnings.push("Identificação do ativo ambígua.");

      const rowFingerprint = fingerprint([
        product.ticker, parsedDate, movementType, quantity, unitPrice, operationValue, institution,
      ]);
      seen.set(rowFingerprint, (seen.get(rowFingerprint) ?? 0) + 1);

      const status: B3RowStatus = errors.length
        ? "INVALID"
        : classification.group === "B3_UNCLASSIFIED"
          ? "UNCLASSIFIED"
          : warnings.length
            ? "REVIEW"
            : "VALID";

      return {
        index, raw, direction, date: parsedDate, movementType, product, quantity, unitPrice,
        operationValue, ...classification, status, observation: classification.explanation,
        possibleDuplicate: false, fingerprint: rowFingerprint, errors, warnings,
      };
    });

    for (const row of rows) {
      if ((seen.get(row.fingerprint) ?? 0) > 1) {
        row.possibleDuplicate = true;
        row.warnings.push("Possível duplicidade dentro deste arquivo.");
        if (row.status === "VALID") row.status = "REVIEW";
      }
    }

    const eventCounts = new Map<string, number>();
    rows.forEach((row) => eventCounts.set(row.movementType || "Não classificado", (eventCounts.get(row.movementType || "Não classificado") ?? 0) + 1));

    return {
      fileName,
      sheetName: "Movimentação",
      rows,
      totals: {
        total: rows.length,
        valid: rows.filter((row) => row.status !== "INVALID" && row.status !== "UNCLASSIFIED").length,
        warnings: rows.filter((row) => row.status === "REVIEW" || row.status === "INVALID").length,
        unclassified: rows.filter((row) => row.status === "UNCLASSIFIED").length,
        assetsFound: new Set(rows.filter((row) => row.product.assetId).map((row) => row.product.assetId)).size,
        assetsNotFound: new Set(rows.filter((row) => row.product.identificationStatus === "NOT_FOUND").map((row) => row.product.ticker)).size,
      },
      eventCounts: [...eventCounts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    };
  }
}