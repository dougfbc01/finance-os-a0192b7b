// B3QuoteHistoryImportService — manual import of B3 COTAHIST files into
// market_price_history. Files are always uploaded by the user (B3 terms forbid
// automated collection). Layout (official "SeriesHistoricas_Layout"):
//   TIPREG 01-02 | DATA 03-10 (AAAAMMDD) | CODBDI 11-12 | CODNEG 13-24 |
//   TPMERC 25-27 | ... | PREULT 109-121 (2 implied decimals)
// Header TIPREG=00, trailer TIPREG=99. Only TPMERC=010 (mercado à vista).
// Prices are stored as published (no adjustment for dividends/splits).
import { Unzip, UnzipInflate } from "fflate";
import { MarketHistoricalPriceService } from "./MarketHistoricalPriceService";
import type { MarketPricePoint } from "@/models/MarketData";
import type { UUID } from "@/models";

export const B3_COTAHIST_PROVIDER = "B3_COTAHIST";

export interface CotahistRecord {
  date: string;
  ticker: string;
  market: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}

export interface QuoteImportTarget {
  assetId: UUID;
  assetName: string;
  ticker: string;
  /** First movement date (YYYY-MM-DD); months before it are ignored. */
  from: string;
}

export interface QuoteImportAssetPreview {
  assetId: UUID;
  assetName: string;
  ticker: string;
  found: MarketPricePoint[];
  existing: MarketPricePoint[];
  toInsert: MarketPricePoint[];
  missingMonths: string[];
}

export interface QuoteImportPreview {
  linesRead: number;
  fileFrom: string | null;
  fileTo: string | null;
  assets: QuoteImportAssetPreview[];
  absentAssets: { assetId: UUID; assetName: string; ticker: string }[];
  toInsertCount: number;
  existingCount: number;
}

const price = (raw: string): number | null => {
  if (!/^\d+$/.test(raw.trim())) return null;
  const v = Number(raw.trim()) / 100;
  return Number.isFinite(v) ? v : null;
};

/** Same normalization as the B3 movement import; fractional suffix F maps to the base ticker. */
export function normalizeB3Ticker(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z][A-Z0-9]{3}\d{1,2}F$/.test(t) ? t.slice(0, -1) : t;
}

/** Parses one COTAHIST line; returns null for header, trailer, invalid or non-spot records. */
export function parseCotahistLine(line: string): CotahistRecord | null {
  if (line.length < 121 || line.slice(0, 2) !== "01") return null;
  const market = line.slice(24, 27);
  if (market !== "010") return null;
  const d = line.slice(2, 10);
  if (!/^\d{8}$/.test(d)) return null;
  const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const close = price(line.slice(108, 121));
  if (close === null || close <= 0) return null;
  const vol = line.length >= 188 ? price(line.slice(170, 188)) : null;
  return {
    date, market, close,
    ticker: normalizeB3Ticker(line.slice(12, 24)),
    open: price(line.slice(56, 69)), high: price(line.slice(69, 82)), low: price(line.slice(82, 95)),
    volume: vol,
  };
}

/** Keeps, per target ticker and month, the last trading session (from the month of the first movement). */
export class CotahistAccumulator {
  linesRead = 0;
  fileFrom: string | null = null;
  fileTo: string | null = null;
  private readonly byTicker = new Map<string, QuoteImportTarget[]>();
  private readonly last = new Map<string, Map<string, CotahistRecord>>();

  constructor(targets: QuoteImportTarget[]) {
    for (const t of targets) {
      const key = normalizeB3Ticker(t.ticker);
      this.byTicker.set(key, [...(this.byTicker.get(key) ?? []), t]);
    }
  }

  push(line: string) {
    if (!line.trim()) return;
    this.linesRead++;
    const r = parseCotahistLine(line);
    if (!r) return;
    if (!this.fileFrom || r.date < this.fileFrom) this.fileFrom = r.date;
    if (!this.fileTo || r.date > this.fileTo) this.fileTo = r.date;
    if (!this.byTicker.has(r.ticker)) return;
    const months = this.last.get(r.ticker) ?? new Map<string, CotahistRecord>();
    const month = r.date.slice(0, 7);
    const current = months.get(month);
    if (!current || r.date > current.date) months.set(month, r);
    this.last.set(r.ticker, months);
  }

  /** Builds the preview; `stored` = existing price dates per asset (never overwritten). */
  preview(stored: Record<string, string[]>, fetchedAt = new Date().toISOString()): QuoteImportPreview {
    const assets: QuoteImportAssetPreview[] = [];
    const absentAssets: QuoteImportPreview["absentAssets"] = [];
    for (const [ticker, targets] of this.byTicker) {
      const months = this.last.get(ticker);
      for (const t of targets) {
        const fromMonth = t.from.slice(0, 7);
        const found = [...(months?.values() ?? [])]
          .filter((r) => r.date.slice(0, 7) >= fromMonth)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map<MarketPricePoint>((r) => ({
            ticker: t.ticker.trim().toUpperCase(), date: r.date, close: r.close, open: r.open, high: r.high,
            low: r.low, volume: r.volume, provider: B3_COTAHIST_PROVIDER, fetchedAt,
          }));
        if (found.length === 0) {
          absentAssets.push({ assetId: t.assetId, assetName: t.assetName, ticker: t.ticker });
          continue;
        }
        const storedDates = new Set(stored[t.assetId] ?? []);
        const foundMonths = new Set(found.map((p) => p.date.slice(0, 7)));
        const missingMonths = this.fileFrom && this.fileTo
          ? monthsBetween(maxStr(this.fileFrom.slice(0, 7), fromMonth), this.fileTo.slice(0, 7)).filter((m) => !foundMonths.has(m))
          : [];
        assets.push({
          assetId: t.assetId, assetName: t.assetName, ticker: t.ticker, found,
          existing: found.filter((p) => storedDates.has(p.date)),
          toInsert: found.filter((p) => !storedDates.has(p.date)),
          missingMonths,
        });
      }
    }
    assets.sort((a, b) => a.ticker.localeCompare(b.ticker));
    return {
      linesRead: this.linesRead, fileFrom: this.fileFrom, fileTo: this.fileTo, assets, absentAssets,
      toInsertCount: assets.reduce((s, a) => s + a.toInsert.length, 0),
      existingCount: assets.reduce((s, a) => s + a.existing.length, 0),
    };
  }
}

const maxStr = (a: string, b: string) => (a > b ? a : b);

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number) as [number, number];
  for (let guard = 0; guard < 1200; guard++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > to) break;
    out.push(key);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** Streams text lines decoded as Windows-1252 into `onLine`. */
async function streamLines(chunks: AsyncIterable<Uint8Array>, onLine: (line: string) => void) {
  const decoder = new TextDecoder("windows-1252");
  let rest = "";
  for await (const chunk of chunks) {
    rest += decoder.decode(chunk, { stream: true });
    const lines = rest.split(/\r?\n/);
    rest = lines.pop() ?? "";
    for (const l of lines) onLine(l);
    await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive
  }
  rest += decoder.decode();
  if (rest) onLine(rest);
}

async function* readStream(file: Blob): AsyncIterable<Uint8Array> {
  const reader = file.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield value;
  }
}

/** Unzips .txt entries of a .zip in blocks, yielding decompressed chunks. */
async function* unzipStream(file: Blob): AsyncIterable<Uint8Array> {
  const queue: Uint8Array[] = [];
  let error: unknown = null;
  const unzip = new Unzip((entry) => {
    if (!/\.txt$/i.test(entry.name)) return;
    entry.ondata = (err, data) => { if (err) error = err; else if (data.length) queue.push(data); };
    entry.start();
  });
  unzip.register(UnzipInflate);
  const reader = file.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    unzip.push(value ?? new Uint8Array(), done);
    if (error) throw error;
    while (queue.length) yield queue.shift()!;
    if (done) return;
  }
}

export const B3QuoteHistoryImportService = {
  /** Earliest movement date per asset (includes conversion source tags). */
  targetsFrom(
    assets: { id: UUID; name: string; ticker?: string | null; deleted_at?: string | null }[],
    movements: { asset_id: UUID | null; transaction_date: string; deleted_at?: string | null; tags?: string[] | null }[],
  ): QuoteImportTarget[] {
    return assets.filter((a) => !a.deleted_at && (a.ticker ?? "").trim()).flatMap((a) => {
      const first = movements
        .filter((m) => !m.deleted_at && (m.asset_id === a.id || (m.tags ?? []).includes(`cost:SOURCE:${a.id}`)))
        .map((m) => m.transaction_date).sort()[0];
      return first ? [{ assetId: a.id, assetName: a.name, ticker: (a.ticker ?? "").trim().toUpperCase(), from: first }] : [];
    });
  },

  /** Reads uploaded .zip/.txt files in the browser (streaming) and builds the preview. */
  async readFiles(
    workspaceId: UUID,
    files: File[],
    targets: QuoteImportTarget[],
    onProgress: (p: { file: string; lines: number }) => void,
  ): Promise<QuoteImportPreview> {
    const acc = new CotahistAccumulator(targets);
    for (const file of files) {
      const chunks = /\.zip$/i.test(file.name) ? unzipStream(file) : readStream(file);
      let tick = 0;
      await streamLines(chunks, (line) => {
        acc.push(line);
        if (++tick % 20000 === 0) onProgress({ file: file.name, lines: acc.linesRead });
      });
      onProgress({ file: file.name, lines: acc.linesRead });
    }
    const stored: Record<string, string[]> = {};
    await Promise.all(targets.map(async (t) => {
      const points = await MarketHistoricalPriceService.listStored({
        workspaceId, assetId: t.assetId, ticker: t.ticker, from: t.from.slice(0, 7) + "-01", to: "9999-12-31",
      });
      stored[t.assetId] = points.map((p) => p.date);
    }));
    return acc.preview(stored);
  },

  /** Persists only new rows; existing rows (BRAPI or earlier imports) are never overwritten. */
  async commit(workspaceId: UUID, preview: QuoteImportPreview): Promise<{ inserted: number; ignored: number }> {
    let inserted = 0;
    let candidates = 0;
    for (const a of preview.assets) {
      if (a.toInsert.length === 0) continue;
      candidates += a.toInsert.length;
      inserted += await MarketHistoricalPriceService.store(
        { workspaceId, assetId: a.assetId, ticker: a.ticker, from: a.toInsert[0]!.date, to: a.toInsert.at(-1)!.date },
        a.toInsert,
      );
    }
    return { inserted, ignored: preview.existingCount + (candidates - inserted) };
  },
};
