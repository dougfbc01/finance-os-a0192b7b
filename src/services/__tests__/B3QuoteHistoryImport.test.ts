import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { unzipSync } from "fflate";

const store = vi.fn();
vi.mock("../MarketHistoricalPriceService", () => ({
  MarketHistoricalPriceService: { store: (...a: unknown[]) => store(...a), listStored: vi.fn() },
}));

import { B3QuoteHistoryImportService, CotahistAccumulator, normalizeB3Ticker, parseCotahistLine } from "../B3QuoteHistoryImportService";

const p13 = (v: number) => String(Math.round(v * 100)).padStart(13, "0");
function line(date: string, ticker: string, close: number, market = "010", name = "EMPRESA") {
  const s = "01" + date.replace(/-/g, "") + "02" + ticker.padEnd(12) + market + name.padEnd(12) + "ON".padEnd(10) + "   " + "R$  "
    + p13(close) + p13(close) + p13(close) + p13(close) + p13(close);
  return s.padEnd(245, "0");
}
const target = (ticker: string, from = "2003-01-01", assetId = ticker) => ({ assetId, assetName: ticker + " SA", ticker, from });

describe("B3QuoteHistoryImportService", () => {
  beforeEach(() => store.mockReset());

  it("ignores header and trailer and divides prices by 100", () => {
    expect(parseCotahistLine("00COTAHIST.2003BOVESPA 20040531".padEnd(245))).toBeNull();
    expect(parseCotahistLine("99COTAHIST.2003BOVESPA 20040531".padEnd(245))).toBeNull();
    expect(parseCotahistLine(line("2003-02-12", "VALE3", 103.21))?.close).toBe(103.21);
  });

  it("keeps only the spot market", () => {
    expect(parseCotahistLine(line("2003-02-12", "VALE3", 10, "070"))).toBeNull();
    expect(parseCotahistLine(line("2003-02-12", "VALE3F", 10, "020"))).toBeNull();
  });

  it("normalizes the fractional F suffix", () => {
    expect(normalizeB3Ticker("TMCP4F ")).toBe("TMCP4");
    expect(normalizeB3Ticker("ITSA4")).toBe("ITSA4");
  });

  it("selects the last trading session of each month", () => {
    const acc = new CotahistAccumulator([target("VALE3")]);
    [line("2003-02-10", "VALE3", 10), line("2003-02-28", "VALE3", 12), line("2003-02-20", "VALE3", 11)].forEach((l) => acc.push(l));
    const pv = acc.preview({});
    expect(pv.assets[0]!.found.map((p) => [p.date, p.close])).toEqual([["2003-02-28", 12]]);
    expect(pv.assets[0]!.found[0]!.provider).toBe("B3_COTAHIST");
  });

  it("ignores zero price", () => {
    const acc = new CotahistAccumulator([target("VALE3")]);
    acc.push(line("2003-02-10", "VALE3", 10));
    acc.push(line("2003-02-27", "VALE3", 0));
    expect(acc.preview({}).assets[0]!.found[0]!.date).toBe("2003-02-10");
  });

  it("reports assets absent from the file", () => {
    const acc = new CotahistAccumulator([target("VALE3"), target("XPTO3")]);
    acc.push(line("2003-02-10", "VALE3", 10));
    expect(acc.preview({}).absentAssets.map((a) => a.ticker)).toEqual(["XPTO3"]);
  });

  it("ignores months before the first movement and reports months without session", () => {
    const acc = new CotahistAccumulator([target("VALE3", "2003-02-15"), target("ITSA4")]);
    acc.push(line("2003-01-10", "VALE3", 9));
    acc.push(line("2003-02-10", "VALE3", 10));
    acc.push(line("2003-04-10", "ITSA4", 5));
    const vale = acc.preview({}).assets.find((a) => a.ticker === "VALE3")!;
    expect(vale.found.map((p) => p.date)).toEqual(["2003-02-10"]);
    expect(vale.missingMonths).toEqual(["2003-03", "2003-04"]);
  });

  it("never overwrites stored rows and is idempotent", async () => {
    const acc = new CotahistAccumulator([target("VALE3")]);
    acc.push(line("2003-02-10", "VALE3", 10));
    acc.push(line("2003-03-10", "VALE3", 11));
    const pv = acc.preview({ VALE3: ["2003-02-10"] });
    expect(pv.existingCount).toBe(1);
    expect(pv.assets[0]!.toInsert.map((p) => p.date)).toEqual(["2003-03-10"]);
    store.mockResolvedValueOnce(1);
    expect(await B3QuoteHistoryImportService.commit("ws", pv)).toEqual({ inserted: 1, ignored: 1 });
    const again = acc.preview({ VALE3: ["2003-02-10", "2003-03-10"] });
    expect(again.toInsertCount).toBe(0);
    store.mockClear();
    await B3QuoteHistoryImportService.commit("ws", again);
    expect(store).not.toHaveBeenCalled();
  });

  it("decodes accented names (Windows-1252) without breaking positions", () => {
    const l = line("2003-02-12", "VALE3", 10, "010", "SÃO PAULO");
    const bytes = Uint8Array.from([...l].map((c) => c.charCodeAt(0)));
    const decoded = new TextDecoder("windows-1252").decode(bytes);
    expect(decoded.slice(27, 36)).toBe("SÃO PAULO");
    expect(parseCotahistLine(decoded)?.close).toBe(10);
  });

  it("parses the official demo file", () => {
    const zip = "/mnt/user-uploads/SeriesHistoricas_DemoCotacoesHistoricas12022003.zip";
    if (!existsSync(zip)) return;
    const text = new TextDecoder("windows-1252").decode(Object.values(unzipSync(readFileSync(zip)))[0]);
    const acc = new CotahistAccumulator([target("VALE3"), target("TMCP4")]);
    text.split(/\r?\n/).forEach((l) => acc.push(l));
    const pv = acc.preview({});
    const vale = pv.assets.find((a) => a.ticker === "VALE3")!;
    expect(vale.found[0]).toMatchObject({ date: "2003-02-12", close: 103.21 });
    expect(pv.assets.find((a) => a.ticker === "TMCP4")).toBeDefined();
  });
});
