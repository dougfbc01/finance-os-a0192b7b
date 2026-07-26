// B3Importer — Stub arquitetural (Mega Sprint 3).
// Prepara suporte futuro para arquivos de negociação/posição da B3 (CEI/InvestidorB3).
// Não implementa parsing real ainda.
import type { Importer, ImportContext, PreviewResult } from "./types";

export class B3Importer implements Importer {
  readonly source = "B3" as never; // fonte adicionada ao enum quando integração for ativada

  parse(): Record<string, unknown>[] {
    throw new Error("Importador B3 ainda não implementado.");
  }

  validate() {
    return { valid: [], invalid: 0 };
  }

  async preview(
    _fileText: string,
    _ctx: ImportContext,
    _fileName: string,
    _fileHash: string,
  ): Promise<PreviewResult> {
    throw new Error("Importador B3 ainda não implementado.");
  }
}
