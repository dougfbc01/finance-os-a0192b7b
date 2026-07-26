// NubankCaixinhasImporter — Stub arquitetural (Mega Sprint 3).
// Suporta futuras importações das caixinhas do Nubank como ativos (asset_type = CAIXINHA).
// Não implementa parsing real ainda.
import type { Importer, ImportContext, PreviewResult } from "./types";

export class NubankCaixinhasImporter implements Importer {
  readonly source = "NUBANK_CAIXINHAS" as never;

  parse(): Record<string, unknown>[] {
    throw new Error("Importador Nubank Caixinhas ainda não implementado.");
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
    throw new Error("Importador Nubank Caixinhas ainda não implementado.");
  }
}
