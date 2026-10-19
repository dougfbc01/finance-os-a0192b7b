import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBrapiHistorical } from "../marketData.server";

afterEach(() => vi.unstubAllGlobals());

describe("Histórico do provider respeita o limite do plano", () => {
  it("usa o maior período permitido quando o solicitado é recusado, sem preços fora do intervalo", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const range = new URL(url).searchParams.get("range") ?? "";
      calls.push(range);
      if (range === "1y") return new Response(JSON.stringify({ error: true, code: "INVALID_RANGE", message: 'O range "1y" não está disponível. Ranges permitidos: 1d, 5d, 1mo, 3mo. Faça upgrade.' }), { status: 400 });
      const ts = (d: string) => Date.parse(`${d}T12:00:00Z`) / 1000;
      return new Response(JSON.stringify({ results: [{ historicalDataPrice: [{ date: ts("2026-07-20"), close: 10 }, { date: ts("2026-10-15"), close: 12 }] }] }), { status: 200 });
    }));
    const res = await fetchBrapiHistorical("itsa3", { from: "2025-10-16", to: "2026-10-16" });
    expect(calls).toEqual(["1y", "3mo"]);
    expect(res.status).toBe("OK");
    expect(res.points.map((p) => [p.date, p.close])).toEqual([["2026-07-20", 10], ["2026-10-15", 12]]);
    expect(res.message).toContain("3mo");
  });
});
