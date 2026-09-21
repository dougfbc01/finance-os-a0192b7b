import { describe, expect, it } from "vitest";
import { B3ImportCommitService } from "../B3ImportCommitService";
import { B3ImportService } from "../B3ImportService";
import { MovementServiceImpl } from "../MovementService";
import type { B3RawRow } from "@/models/B3Import";
import type { Movement } from "@/models";

const asset = { id: "asset-1", ticker: "WEGE3", name: "WEG" };
const raw = (movement: string, overrides: Partial<B3RawRow> = {}): B3RawRow => ({
  "Entrada/Saída": "Crédito", Data: "29/07/2025", Movimentação: movement,
  Produto: "WEGE3 - WEG", Instituição: "CORRETORA", Quantidade: 10,
  "Preço unitário": 100, "Valor da Operação": 1000, ...overrides,
});
const row = (movement: string, overrides: Partial<B3RawRow> = {}) =>
  B3ImportService.buildPreview("b3.xlsx", [raw(movement, overrides)], [asset]).rows[0];

describe("Sprint 4.17B — commit histórico B3", () => {
  it.each([
    ["Compra", "op:APORTE", "INVESTMENT"],
    ["Resgate", "op:RESGATE", "INVESTMENT"],
    ["VENCIMENTO", "op:RESGATE", "INVESTMENT"],
    ["Dividendo", "op:RENDIMENTO", "DIVIDEND"],
    ["Juros Sobre Capital Próprio", "op:RENDIMENTO", "INTEREST"],
    ["Rendimento", "op:RENDIMENTO", "INTEREST"],
    ["Restituição de Capital", "op:RENDIMENTO", "INTEREST"],
  ])("mapeia %s como histórico neutro para caixa", (name, tag, type) => {
    const payload = B3ImportCommitService.movement(row(name), "workspace-1", "import-1");
    expect(payload).toMatchObject({ type, is_historical: true, account_id: null, card_id: null, invoice_id: null, import_id: "import-1" });
    expect(payload?.tags).toContain(tag);
    expect(MovementServiceImpl.impactOnAccount(payload as unknown as Movement, "account-1")).toBe(0);
  });

  it.each([
    ["Bonificação em Ativos", "Crédito", "qty:INCREASE"],
    ["Desdobro", "Crédito", "qty:INCREASE"],
    ["Grupamento", "Débito", "qty:DECREASE"],
  ])("mapeia %s como ajuste de quantidade sem valor", (name, direction, tag) => {
    const payload = B3ImportCommitService.movement(row(name, { "Entrada/Saída": direction }), "workspace-1", "import-1");
    expect(payload).toMatchObject({ amount: 0, quantity: 10, is_historical: true });
    expect(payload?.tags).toContain(tag);
  });

  it.each(["Transferência", "Transferência - Liquidação"])("preserva %s sem inferir variação de posição", (name) => {
    const payload = B3ImportCommitService.movement(row(name), "workspace-1", "import-1");
    expect(payload).toMatchObject({ amount: 0, quantity: null });
    expect(payload?.tags).toContain("op:EVENTO");
  });

  it("mantém COMPRA / VENDA pendente", () => {
    expect(B3ImportCommitService.eligibility(row("COMPRA / VENDA"))).toMatchObject({ status: "PENDING_REVIEW" });
    expect(B3ImportCommitService.movement(row("COMPRA / VENDA"), "workspace-1", "import-1")).toBeNull();
  });

  it("mantém ativo não encontrado pendente", () => {
    const missing = B3ImportService.buildPreview("b3.xlsx", [raw("Compra", { Produto: "ABCD3" })], [asset]).rows[0];
    expect(B3ImportCommitService.eligibility(missing).status).toBe("PENDING_REVIEW");
  });

  it("usa referência determinística igual para a mesma linha", () => {
    const first = B3ImportCommitService.movement(row("Compra"), "workspace-1", "import-1");
    const second = B3ImportCommitService.movement(row("Compra"), "workspace-1", "import-2");
    expect(first?.external_ref).toBe(second?.external_ref);
    expect(first?.duplicate_hash).toBe(second?.duplicate_hash);
  });

  it("distingue fingerprints quando a direção muda", () => {
    expect(row("Compra", { "Entrada/Saída": "Crédito" }).fingerprint).not.toBe(row("Compra", { "Entrada/Saída": "Débito" }).fingerprint);
  });

  it("preserva a linha B3 original nas notas", () => {
    const payload = B3ImportCommitService.movement(row("Compra"), "workspace-1", "import-1");
    expect(JSON.parse(payload?.notes ?? "{}").raw).toMatchObject({ Movimentação: "Compra", Produto: "WEGE3 - WEG" });
  });

  it("processa 1.344 linhas mantendo fingerprint em cada evento", () => {
    const rows = Array.from({ length: 1344 }, (_, index) => raw("Compra", { Data: `2025-07-${String((index % 28) + 1).padStart(2, "0")}`, Quantidade: index + 1 }));
    const preview = B3ImportService.buildPreview("b3.xlsx", rows, [asset]);
    expect(preview.rows).toHaveLength(1344);
    expect(preview.rows.every((item) => item.fingerprint.length > 10)).toBe(true);
  });
});