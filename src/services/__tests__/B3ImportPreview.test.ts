import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { B3ClassificationService } from "../B3ClassificationService";
import { B3ImportService } from "../B3ImportService";
import { B3ProductParser } from "../B3ProductParser";
import { parseB3Workbook } from "@/lib/b3Import.server";
import { B3_REQUIRED_COLUMNS, type B3AssetReference, type B3RawRow } from "@/models/B3Import";

const assets: B3AssetReference[] = [
  { id: "asset-wege3", ticker: "WEGE3", name: "WEG S.A." },
  { id: "asset-bbas3", ticker: "BBAS3", name: "Banco do Brasil" },
];

const baseRow = (overrides: Partial<B3RawRow> = {}): B3RawRow => ({
  "Entrada/Saída": "Crédito",
  Data: "29/07/2025",
  Movimentação: "Transferência - Liquidação",
  Produto: "WEGE3 - WEG S.A.",
  Instituição: "CORRETORA TESTE",
  Quantidade: 10,
  "Preço unitário": 36.12,
  "Valor da Operação": 361.2,
  ...overrides,
});

function workbook(rows: B3RawRow[], sheetName = "Movimentação", headers = [...B3_REQUIRED_COLUMNS]) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers as string[] });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
}

describe("Sprint 4.17A — parser B3", () => {
  it("lê explicitamente as oito colunas da aba Movimentação", () => {
    const parsed = parseB3Workbook(workbook([baseRow()]));
    expect(parsed).toHaveLength(1);
    expect(Object.keys(parsed[0])).toEqual(B3_REQUIRED_COLUMNS);
  });

  it("normaliza hífen como ausência, nunca como zero", () => {
    const preview = B3ImportService.buildPreview("b3.xlsx", [baseRow({ Quantidade: "-", "Preço unitário": "-", "Valor da Operação": "-" })], assets);
    expect(preview.rows[0]).toMatchObject({ quantity: null, unitPrice: null, operationValue: null });
  });

  it("extrai o ticker do produto com nome", () => {
    expect(B3ProductParser.parse("GOAU4 - METALURGICA GERDAU S.A.", null, []).ticker).toBe("GOAU4");
  });

  it("identifica um ativo existente no workspace", () => {
    expect(B3ProductParser.parse("WEGE3 - WEG S.A.", null, assets)).toMatchObject({ identificationStatus: "FOUND", assetId: "asset-wege3" });
  });

  it("sinaliza ticker extraído sem ativo correspondente", () => {
    expect(B3ProductParser.parse("HABT11", null, assets).identificationStatus).toBe("NOT_FOUND");
  });

  it("sinaliza produto sem ticker seguro", () => {
    expect(B3ProductParser.parse("PRODUTO SEM CODIGO", null, assets).identificationStatus).toBe("UNIDENTIFIED");
  });

  it("classifica os 21 tipos observados", () => {
    const expected = {
      Rendimento: ["B3_INCOME", "YIELD"],
      "Juros Sobre Capital Próprio": ["B3_INCOME", "JCP"],
      Dividendo: ["B3_INCOME", "DIVIDEND"],
      "Transferência - Liquidação": ["B3_TRANSFER", "TRANSFER_SETTLEMENT"],
      Atualização: ["B3_POSITION_EVENT", "UPDATE"],
      "Leilão de Fração": ["B3_CORPORATE_EVENT", "FRACTION_AUCTION"],
      "Fração em Ativos": ["B3_CORPORATE_EVENT", "FRACTION"],
      "Direitos de Subscrição - Não Exercido": ["B3_CORPORATE_EVENT", "SUBSCRIPTION_RIGHT_NOT_EXERCISED"],
      "Bonificação em Ativos": ["B3_POSITION_EVENT", "BONUS"],
      "Direito de Subscrição": ["B3_CORPORATE_EVENT", "SUBSCRIPTION_RIGHT"],
      Compra: ["B3_INVESTMENT_OPERATION", "BUY"],
      Resgate: ["B3_INVESTMENT_OPERATION", "REDEMPTION"],
      Transferência: ["B3_TRANSFER", "TRANSFER"],
      Incorporação: ["B3_POSITION_EVENT", "INCORPORATION"],
      Grupamento: ["B3_POSITION_EVENT", "REVERSE_SPLIT"],
      "Restituição de Capital": ["B3_INCOME", "CAPITAL_RETURN"],
      Desdobro: ["B3_POSITION_EVENT", "SPLIT"],
      "Cessão de Direitos - Solicitada": ["B3_CORPORATE_EVENT", "RIGHTS_ASSIGNMENT_REQUESTED"],
      "Cessão de Direitos": ["B3_CORPORATE_EVENT", "RIGHTS_ASSIGNMENT"],
      "COMPRA / VENDA": ["B3_INVESTMENT_OPERATION", "BUY_SELL"],
      VENCIMENTO: ["B3_INVESTMENT_OPERATION", "MATURITY"],
    } as const;
    for (const [type, [group, event]] of Object.entries(expected)) {
      expect(B3ClassificationService.classify(type)).toMatchObject({ group, event });
    }
  });

  it("não transforma Crédito isoladamente em receita", () => {
    const row = B3ImportService.buildPreview("b3.xlsx", [baseRow({ "Entrada/Saída": "Crédito" })], assets).rows[0];
    expect(row.group).toBe("B3_TRANSFER");
    expect(row.cashImpact).toBe("UNKNOWN");
  });

  it.each([
    ["Bonificação em Ativos", "BONUS"],
    ["Desdobro", "SPLIT"],
    ["Grupamento", "REVERSE_SPLIT"],
  ])("classifica %s sem impacto de caixa", (movement, event) => {
    expect(B3ClassificationService.classify(movement)).toMatchObject({ event, cashImpact: "NO", positionImpact: "YES" });
  });

  it("classifica Transferência - Liquidação como B3_TRANSFER", () => {
    expect(B3ClassificationService.classify("Transferência - Liquidação")).toMatchObject({ group: "B3_TRANSFER", event: "TRANSFER_SETTLEMENT" });
  });

  it("classifica Leilão de Fração como evento corporativo", () => {
    expect(B3ClassificationService.classify("Leilão de Fração")).toMatchObject({ group: "B3_CORPORATE_EVENT", event: "FRACTION_AUCTION" });
  });

  it("classifica Compra como operação de investimento", () => {
    expect(B3ClassificationService.classify("Compra")).toMatchObject({ group: "B3_INVESTMENT_OPERATION", event: "BUY" });
  });

  it.each([
    ["Dividendo", "DIVIDEND"],
    ["Juros Sobre Capital Próprio", "JCP"],
    ["Rendimento", "YIELD"],
  ])("classifica %s como evento de rendimento sem criar caixa", (movement, event) => {
    expect(B3ClassificationService.classify(movement)).toMatchObject({ group: "B3_INCOME", event, cashImpact: "UNKNOWN" });
  });

  it("marca fingerprints repetidos como possível duplicidade sem remover linhas", () => {
    const preview = B3ImportService.buildPreview("b3.xlsx", [baseRow(), baseRow()], assets);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows.every((row) => row.possibleDuplicate)).toBe(true);
  });

  it("rejeita arquivo sem a aba Movimentação", () => {
    expect(() => parseB3Workbook(workbook([baseRow()], "Outra aba"))).toThrow('aba obrigatória "Movimentação"');
  });

  it("rejeita arquivo sem coluna obrigatória", () => {
    const headers = B3_REQUIRED_COLUMNS.filter((column) => column !== "Produto");
    expect(() => parseB3Workbook(workbook([baseRow()], "Movimentação", headers))).toThrow("Produto");
  });

  it("preserva hífens nas três colunas opcionais ao ler o Excel", () => {
    const [parsed] = parseB3Workbook(workbook([baseRow({ Quantidade: "-", "Preço unitário": "-", "Valor da Operação": "-" })]));
    const preview = B3ImportService.buildPreview("b3.xlsx", [parsed], assets);
    expect(preview.rows[0]).toMatchObject({ quantity: null, unitPrice: null, operationValue: null, status: "VALID" });
  });

  it("rejeita a aba Movimentação vazia", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([B3_REQUIRED_COLUMNS]), "Movimentação");
    const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
    expect(() => parseB3Workbook(bytes)).toThrow("não possui linhas");
  });

  it("não expõe qualquer operação de persistência no serviço de preview", () => {
    expect(Object.keys(B3ImportService)).not.toContain("commit");
    expect(Object.keys(B3ImportService)).not.toContain("create");
  });
});