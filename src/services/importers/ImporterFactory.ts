// Strategy factory: escolhe o importador apropriado para o arquivo.
import type { Importer } from "./types";
import type { ImportSource } from "@/models/Import";
import { NubankAccountImporter } from "./NubankAccountImporter";
import { NubankCreditCardImporter } from "./NubankCreditCardImporter";
import { OFXImporter } from "./OFXImporter";

export const IMPORTER_LABELS: Record<ImportSource, string> = {
  NUBANK_ACCOUNT: "Nubank — Conta",
  NUBANK_CREDIT_CARD: "Nubank — Cartão de Crédito",
  OFX: "OFX (Itaú, Caixa, Santander e demais)",
  MANUAL: "Manual",
};

export const IMPORTER_OPTIONS: { value: ImportSource; label: string }[] = [
  { value: "NUBANK_ACCOUNT", label: IMPORTER_LABELS.NUBANK_ACCOUNT },
  { value: "NUBANK_CREDIT_CARD", label: IMPORTER_LABELS.NUBANK_CREDIT_CARD },
  { value: "OFX", label: IMPORTER_LABELS.OFX },
];

export class ImporterFactory {
  static create(source: ImportSource): Importer {
    switch (source) {
      case "NUBANK_ACCOUNT": return new NubankAccountImporter();
      case "NUBANK_CREDIT_CARD": return new NubankCreditCardImporter();
      case "OFX": return new OFXImporter();
      default: throw new Error(`Importador não suportado: ${source}`);
    }
  }

  /** Sugere o tipo com base no conteúdo/extensão do arquivo. */
  static suggest(fileName: string, text: string): ImportSource {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".ofx") || /<OFX>|<STMTTRN>/i.test(text)) return "OFX";
    if (/^date,title,amount/i.test(text.trim().split(/\r?\n/)[0] ?? "")) return "NUBANK_CREDIT_CARD";
    if (/data,valor,identificador,descri/i.test(text.trim().split(/\r?\n/)[0] ?? "")) return "NUBANK_ACCOUNT";
    return "NUBANK_ACCOUNT";
  }
}
