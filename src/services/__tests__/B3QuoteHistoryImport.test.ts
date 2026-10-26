import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { unzipSync, zipSync, strToU8 } from "fflate";

const store = vi.fn();
const listStored = vi.fn();
vi.mock("../MarketHistoricalPriceService", () => ({
  MarketHistoricalPriceService: { store: (...a: unknown[]) => store(...a), listStored: (...a: unknown[]) => listStored(...a) },
}));

import { B3QuoteHistoryImportService, ZIP_CORRUPT_MESSAGE, unzipStream, CotahistAccumulator, normalizeB3Ticker, parseCotahistLine } from "../B3QuoteHistoryImportService";

const p13 = (v: number) => String(Math.round(v * 100)).padStart(13, "0");
function line(date: string, ticker: string, close: number, market = "010", name = "EMPRESA") {
  const s = "01" + date.replace(/-/g, "") + "02" + ticker.padEnd(12) + market + name.padEnd(12) + "ON".padEnd(10) + "   " + "R$  "
    + p13(close) + p13(close) + p13(close) + p13(close) + p13(close);
  return s.padEnd(245, "0");
}
const target = (ticker: string, from = "2003-01-01", assetId = ticker) => ({ assetId, assetName: ticker + " SA", ticker, from });

describe("B3QuoteHistoryImportService", () => {
  beforeEach(() => { store.mockReset(); listStored.mockReset(); listStored.mockResolvedValue([]); });

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
    expect(await B3QuoteHistoryImportService.commit("ws", pv)).toEqual({ inserted: 1, ignored: 1, failed: [] });
    const again = acc.preview({ VALE3: ["2003-02-10", "2003-03-10"] });
    expect(again.toInsertCount).toBe(0);
    store.mockClear();
    await B3QuoteHistoryImportService.commit("ws", again);
    expect(store).not.toHaveBeenCalled();
  });

  it("skips a month already covered by a BRAPI quote on another day", async () => {
    const acc = new CotahistAccumulator([target("VALE3")]);
    acc.push(line("2003-02-28", "VALE3", 10));
    acc.push(line("2003-03-31", "VALE3", 11));
    const pv = acc.preview({ VALE3: ["2003-02-03"] });
    expect(pv.existingCount).toBe(1);
    expect(pv.assets[0]!.toInsert.map((p) => p.date)).toEqual(["2003-03-31"]);
    store.mockResolvedValueOnce(1);
    expect(await B3QuoteHistoryImportService.commit("ws", pv)).toEqual({ inserted: 1, ignored: 1, failed: [] });
    expect(store.mock.calls[0]![1].map((p: { date: string }) => p.date)).toEqual(["2003-03-31"]);
  });

  it("writes the B3 quote for a month without any stored quote", async () => {
    const acc = new CotahistAccumulator([target("VALE3")]);
    acc.push(line("2003-02-28", "VALE3", 10));
    const pv = acc.preview({});
    store.mockResolvedValueOnce(1);
    expect(await B3QuoteHistoryImportService.commit("ws", pv)).toEqual({ inserted: 1, ignored: 0, failed: [] });
  });

  it("revalidates coverage at commit: a stale preview writes nothing new", async () => {
    const acc = new CotahistAccumulator([target("VALE3")]);
    acc.push(line("2003-02-28", "VALE3", 10));
    const pv = acc.preview({});
    listStored.mockResolvedValue([{ date: "2003-02-05" }]);
    expect(await B3QuoteHistoryImportService.commit("ws", pv)).toEqual({ inserted: 0, ignored: 1, failed: [] });
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

  it("isolates a failing asset: others are written and the failure is reported", async () => {
    const acc = new CotahistAccumulator([target("VALE3"), target("ITSA4"), target("PETR4")]);
    ["VALE3", "ITSA4", "PETR4"].forEach((t) => acc.push(line("2003-02-28", t, 10)));
    const pv = acc.preview({});
    store.mockImplementation(async (q: { assetId: string }) => {
      if (q.assetId === "ITSA4") throw { message: "permission denied for table market_price_history", code: "42501", details: null, hint: null };
      return 1;
    });
    const r = await B3QuoteHistoryImportService.commit("ws", pv, 0);
    expect(r.inserted).toBe(2);
    expect(r.failed).toEqual([{ assetId: "ITSA4", ticker: "ITSA4", message: "permission denied for table market_price_history (código 42501)" }]);
  });

  it("retries transient failures and queries only the file year", async () => {
    const acc = new CotahistAccumulator([target("VALE3")]);
    acc.push(line("2003-02-28", "VALE3", 10));
    const pv = acc.preview({});
    listStored.mockRejectedValueOnce(new Error("TypeError: Failed to fetch")).mockResolvedValue([]);
    store.mockResolvedValueOnce(1);
    expect(await B3QuoteHistoryImportService.commit("ws", pv, 0)).toEqual({ inserted: 1, ignored: 0, failed: [] });
    expect(listStored).toHaveBeenCalledTimes(2);
    expect(listStored.mock.calls[1]![0]).toMatchObject({ from: "2003-01-01", to: "2003-12-31" });
  });

  it("truncated zip yields the friendly message; complete zip streams the last block", async () => {
    const text = [line("2003-02-10", "VALE3", 10), line("2003-02-28", "VALE3", 12)].join("\r\n");
    const zip = zipSync({ "COTAHIST_A2003.TXT": strToU8(text) });
    const read = async (bytes: Uint8Array) => {
      const parts: Uint8Array[] = [];
      for await (const c of unzipStream(new Blob([bytes]))) parts.push(c);
      return new TextDecoder().decode(Buffer.concat(parts));
    };
    expect(await read(zip)).toBe(text);
    await expect(read(zip.slice(0, Math.floor(zip.length / 2)))).rejects.toThrow(ZIP_CORRUPT_MESSAGE);
  });

  it("reads a plain .txt without decompression", async () => {
    const text = line("2003-02-28", "VALE3", 12) + "\n" + line("2003-03-31", "VALE3", 13);
    const file = new File([text], "COTAHIST_A2003.TXT");
    const pv = await B3QuoteHistoryImportService.readFiles("ws", [file], [target("VALE3")], () => {});
    expect(pv.assets[0]!.found.map((p) => p.date)).toEqual(["2003-02-28", "2003-03-31"]);
    expect(listStored.mock.calls[0]![0]).toMatchObject({ from: "2003-02-01", to: "2003-12-31" });
  });
});
