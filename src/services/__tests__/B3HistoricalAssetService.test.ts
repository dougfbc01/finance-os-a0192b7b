import { describe, expect, it } from "vitest";
import { buildB3HistoricalAssetCandidates } from "../B3HistoricalAssetService";
import type { B3AssetReference, B3PreviewRow } from "@/models/B3Import";

const row = (ticker: string, productName: string, status: B3PreviewRow["product"]["identificationStatus"] = "NOT_FOUND"): B3PreviewRow => ({
  index: 0,
  raw: {
    "Entrada/Saída": "Crédito",
    Data: "29/07/2025",
    Movimentação: "Dividendo",
    Produto: `${ticker} - ${productName}`,
    Instituição: "CORRETORA TESTE",
    Quantidade: 1,
    "Preço unitário": 10,
    "Valor da Operação": 10,
  },
  direction: "Crédito",
  date: "2025-07-29",
  movementType: "Dividendo",
  product: {
    rawProduct: ticker ? `${ticker} - ${productName}` : productName,
    ticker,
    productName,
    institution: "CORRETORA TESTE",
    identificationStatus: status,
    assetId: null,
    assetName: null,
  },
  quantity: 1,
  unitPrice: 10,
  operationValue: 10,
  group: "B3_INCOME",
  event: "DIVIDEND",
  cashImpact: "UNKNOWN",
  positionImpact: "NO",
  nature: "INCOME",
  status: "VALID",
  observation: "",
  possibleDuplicate: false,
  fingerprint: `${ticker}-1`,
  errors: [],
  warnings: [],
});

describe("B3HistoricalAssetService", () => {
  it("gera candidatos seguros para ativos negociáveis ausentes", () => {
    const candidates = buildB3HistoricalAssetCandidates([
      row("BBAS3", "BANCO DO BRASIL S/A"),
      row("IRDM11", "FII IRIDIUM RECEBÍVEIS IMOBILIÁRIOS"),
      row("IVVB11", "ISHARE S&P 500 FIC EM FUNDO DE INDICE IE"),
      row("NUBR33", "NU HOLDINGS LTD."),
      row("RZAG11", "FDO INV CADEIAS PROD AGRO RIZA AGRO FIAGRO IMOB"),
    ], []);

    expect(candidates.map((candidate) => [candidate.ticker, candidate.assetType])).toEqual([
      ["BBAS3", "ACAO"],
      ["IRDM11", "FII"],
      ["IVVB11", "ETF"],
      ["NUBR33", "BDR"],
      ["RZAG11", "FII"],
    ]);
  });

  it("gera candidatos para Tesouro e CDB sem ticker", () => {
    const candidates = buildB3HistoricalAssetCandidates([
      row("", "Tesouro Selic 2027"),
      row("", "CDB - CDB32230TDR - BANCO DAYCOVAL S/A"),
    ], []);

    expect(candidates.map((candidate) => [candidate.ticker, candidate.assetType, candidate.name])).toEqual([
      [null, "CDB", "CDB - CDB32230TDR - BANCO DAYCOVAL S/A"],
      [null, "TESOURO", "Tesouro Selic 2027"],
    ]);
  });

  it("não cria candidatos para direitos quando o tipo não é seguro", () => {
    const candidates = buildB3HistoricalAssetCandidates([
      row("ABCB2", "BANCO ABC BRASIL S.A."),
      row("ITSA1", "ITAUSA S.A."),
      row("VISC12", "VINCI SHOPPING CENTERS FI IMOBILIÁRIO - FII"),
    ], []);

    expect(candidates).toEqual([]);
  });

  it("ignora tickers que já possuem ativo no workspace", () => {
    const assets: B3AssetReference[] = [{ id: "asset-1", ticker: "BBAS3", name: "Banco do Brasil" }];
    expect(buildB3HistoricalAssetCandidates([row("BBAS3", "BANCO DO BRASIL S/A")], assets)).toEqual([]);
  });

  it("não cria candidato quando a linha não está em NOT_FOUND", () => {
    expect(buildB3HistoricalAssetCandidates([row("BBAS3", "BANCO DO BRASIL S/A", "FOUND")], [])).toEqual([]);
  });
});
