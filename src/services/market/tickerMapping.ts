// Sprint 4.10 — mapeamento de dados externos para os enums do Finance OS.
// Regra: nunca "inventar" tipo. Sem certeza => null (usuário escolhe).
import { AssetType } from "@/constants/enums";

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

const FII_HINTS = [
  "FII",
  "FDO INV IMOB",
  "FUNDO DE INVESTIMENTO IMOBILIARIO",
  "FUNDO INVESTIMENTO IMOBILIARIO",
  "IMOBILIARIO",
];
const ETF_HINTS = ["ETF", "INDEX FUND", "ISHARES", "FDO INDICE", "FUNDO DE INDICE", "INDICE"];

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

/**
 * Infere o tipo do ativo a partir do ticker B3 e do nome informado pelo provider.
 * Retorna null quando o padrão é ambíguo.
 */
export function inferAssetType(ticker: string, name: string | null): AssetType | null {
  const t = normalizeTicker(ticker);
  const n = deaccent(name ?? "");

  if (/^[A-Z]{4}(34|35|32|33|39)$/.test(t)) return AssetType.BDR;

  if (/^[A-Z]{4}11B?$/.test(t)) {
    if (FII_HINTS.some((h) => n.includes(h))) return AssetType.FII;
    if (ETF_HINTS.some((h) => n.includes(h))) return AssetType.ETF;
    return null; // Units, FIIs e ETFs compartilham o sufixo 11 — ambíguo.
  }

  if (/^[A-Z]{4}[3456]$/.test(t)) return AssetType.ACAO;

  return null;
}
