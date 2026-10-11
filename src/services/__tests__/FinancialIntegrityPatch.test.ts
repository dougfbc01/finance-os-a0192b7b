import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportService } from "../ImportService";
import { ImportHistoryService } from "../ImportHistoryService";
import { MovementImportExclusionService, MovementImportExclusionServiceImpl } from "../MovementImportExclusionService";
import { ReconciliationService } from "../ReconciliationService";
import { DashboardService } from "../DashboardService";
import { MovementServiceImpl } from "../MovementService";
import { AccountStatementService } from "../AccountStatementService";
import { CardServiceImpl } from "../CardService";
import { NubankCreditCardImporter } from "../importers/NubankCreditCardImporter";
import { MovementType, MovementStatus } from "@/constants/enums";
import type { Account, Movement } from "@/models";
import type { PreviewResult, PreviewRow } from "../importers/types";

const movement = (over: Partial<Movement> = {}): Movement => ({
  id: "m", workspace_id: "ws", account_id: "a", transfer_account_id: null,
  card_id: null, invoice_id: null, type: MovementType.INCOME, amount: 100,
  transaction_date: "2026-10-01", competence_date: "2026-10-01", status: MovementStatus.CLEARED,
  is_historical: false, deleted_at: null, tags: [], ...over,
} as Movement);
const row = (index: number, hash: string): PreviewRow => ({
  index, duplicate_hash: hash, raw: {}, transaction_date: "2026-10-01", amount: 100,
  description: "test", type: MovementType.EXPENSE, status: MovementStatus.CLEARED,
  account_id: "a", card_id: null, transfer_account_id: null, category_id: null,
  subcategory_id: null, isDuplicate: false, isInvalid: false, isTransfer: false,
  isCardPayment: false, errors: [],
});
const preview = (rows: PreviewRow[]): PreviewResult => ({
  source: "OFX", fileName: "statement.ofx", fileHash: "file", rows,
  totals: { total: rows.length, valid: rows.length, invalid: 0, duplicated: 0,
    transfers: 0, incomes: 0, expenses: rows.length, cardPayments: 0 },
});
afterEach(() => vi.restoreAllMocks());

function mockCommit(hashes: string[] = []) {
  vi.spyOn(ImportService, "loadExistingHashes").mockResolvedValue(new Set(hashes));
  vi.spyOn(MovementImportExclusionService, "listHashes").mockResolvedValue(new Set());
  vi.spyOn(ImportHistoryService, "create").mockResolvedValue({ id: "imp" } as never);
  vi.spyOn(ImportHistoryService, "finalize").mockImplementation(async (_id, patch) => ({ id: "imp", ...patch }) as never);
  vi.spyOn(ReconciliationService, "listCandidatesForImport").mockResolvedValue([]);
}

describe("Estabilização — importação", () => {
  it("carrega todos os hashes, incluindo exclusões antigas e páginas após 1000", async () => {
    const pages = Array.from({ length: 1101 }, (_, n) => ({ id: String(n), duplicate_hash: `hash-${n}` }));
    const range = vi.fn(async (from: number, to: number) => ({ data: pages.slice(from, to + 1), error: null }));
    const chain = { select: vi.fn(), eq: vi.fn(), not: vi.fn(), order: vi.fn(), range };
    for (const name of ["select", "eq", "not", "order"] as const) chain[name].mockReturnValue(chain);
    const originalClient = (ImportService as unknown as { client: unknown }).client;
    try {
      (ImportService as unknown as { client: unknown }).client = { from: () => chain };
      const hashes = await ImportService.loadExistingHashes("ws");
      expect(hashes.size).toBe(1101);
      expect(hashes.has("hash-1100")).toBe(true);
      expect(range).toHaveBeenCalledTimes(3);
    } finally { (ImportService as unknown as { client: unknown }).client = originalClient; }
  });

  it("paginação também preserva mais de 1000 exclusões", async () => {
    const pages = Array.from({ length: 1001 }, (_, n) => ({ duplicate_hash: `deleted-${n}` }));
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(async (a: number, b: number) => ({ data: pages.slice(a, b + 1), error: null })) };
    for (const key of ["select", "eq", "order"] as const) chain[key].mockReturnValue(chain);
    const hashes = await new MovementImportExclusionServiceImpl({ from: () => chain } as never).listHashes("ws");
    expect(hashes.size).toBe(1001);
    expect(hashes.has("deleted-1000")).toBe(true);
  });

  it("preview antigo não reinsere lançamento excluído antes da confirmação", async () => {
    mockCommit(["deleted"]);
    const result = await ImportService.commit({ preview: preview([row(0, "deleted")]), workspaceId: "ws", accountId: "a", importedBy: null });
    expect(result.inserted).toBe(0);
    expect(result.duplicated).toBe(1);
  });

  it("conflito de uma linha não descarta as outras do lote", async () => {
    mockCommit();
    const insert = vi.fn((payload: unknown) => ({ select: async () => {
      if (Array.isArray(payload)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      if ((payload as { duplicate_hash: string }).duplicate_hash === "raced") return { data: null, error: { code: "23505" } };
      return { data: [{ id: "new" }], error: null };
    } }));
    const originalClient = (ImportService as unknown as { client: unknown }).client;
    try {
      (ImportService as unknown as { client: unknown }).client = { from: () => ({ insert }) };
      const result = await ImportService.commit({ preview: preview([row(0, "raced"), row(1, "new")]), workspaceId: "ws", accountId: "a", importedBy: null });
      expect(result.inserted).toBe(1);
      expect(result.duplicated).toBe(1);
      expect(insert).toHaveBeenCalledTimes(3);
    } finally { (ImportService as unknown as { client: unknown }).client = originalClient; }
  });

  it("transferência importada não carrega categoria de despesa", async () => {
    mockCommit();
    const insert = vi.fn(() => ({ select: async () => ({ data: [{ id: "new" }], error: null }) }));
    const originalClient = (ImportService as unknown as { client: unknown }).client;
    try {
      (ImportService as unknown as { client: unknown }).client = { from: () => ({ insert }) };
      const transfer = { ...row(0, "t"), type: MovementType.TRANSFER, transfer_account_id: "b", category_id: "expense" };
      await ImportService.commit({ preview: preview([transfer]), workspaceId: "ws", accountId: "a", importedBy: null });
      expect(insert.mock.calls[0][0]).toEqual(expect.arrayContaining([expect.objectContaining({ category_id: null, subcategory_id: null })]));
    } finally { (ImportService as unknown as { client: unknown }).client = originalClient; }
  });
});

describe("Estabilização — cartões e indicadores", () => {
  it("pagamento comum continua compra; somente pagamento específico é quitação", async () => {
    const result = await new NubankCreditCardImporter().preview("date,title,amount\n2026-10-01,Pagamento Mercado Livre,100\n2026-10-01,Pagamento recebido,-100", {
      workspaceId: "ws", accountId: null, cardId: "c", accounts: [], existingHashes: new Set(), defaults: { categoryId: null, subcategoryId: null },
    }, "card.csv", "file");
    expect(result.rows.map(r => r.type)).toEqual([MovementType.EXPENSE, MovementType.CARD_PAYMENT]);
  });

  it("quitação não soma novamente às compras e encargos da fatura", () => {
    expect(CardServiceImpl.computeInvoiceAmount([
      movement({ type: MovementType.EXPENSE, amount: 100 }),
      movement({ type: MovementType.FEE, amount: 10 }),
      movement({ type: MovementType.REFUND, amount: 20 }),
      movement({ type: MovementType.CARD_PAYMENT, amount: 90 }),
      movement({ type: MovementType.TRANSFER, amount: 90 }),
    ])).toBe(90);
  });

  it("dashboard exclui rendimentos B3 históricos de todos os indicadores de receita", () => {
    const movements = [movement(), movement({ is_historical: true, amount: 900 })];
    const range = { start: "2026-10-01", end: "2026-10-31" };
    expect(DashboardService.monthSummary(movements, 2026, 9).income).toBe(100);
    expect(DashboardService.summaryInRange(movements, range).income).toBe(100);
    expect(DashboardService.monthlySeries(movements, ["2026-10"])[0].income).toBe(100);
    expect(DashboardService.incomeByCategory(movements, range)[0].amount).toBe(100);
  });

  it("saldos do extrato, contas e caixa concordam com transferências e compras de cartão", () => {
    const a = { id: "a", initial_balance: 1000 } as Account;
    const b = { id: "b", initial_balance: 0 } as Account;
    const movements = [
      movement({ type: MovementType.TRANSFER, transfer_account_id: "b", transfer_group_id: "g", amount: 300 }),
      movement({ type: MovementType.TRANSFER, account_id: "b", transfer_group_id: "g", amount: 300 }),
      movement({ type: MovementType.EXPENSE, card_id: "c", amount: 50 }),
      movement({ type: MovementType.CARD_PAYMENT, amount: 50 }),
      movement({ is_historical: true, amount: 900 }),
      movement({ deleted_at: "2026-10-02", amount: 900 }),
    ];
    expect(DashboardService.computeBalances([a, b], movements)).toEqual({ a: 650, b: 300 });
    expect(AccountStatementService.currentBalance(a, movements)).toBe(650);
    expect(DashboardService.cashflow([a, b], movements, 1)[0].balance).toBe(950);
    expect(MovementServiceImpl.totals(movements).transfers).toBe(300);
    expect(MovementServiceImpl.totals(movements).income).toBe(0);
  });
});
