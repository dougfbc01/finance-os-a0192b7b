import { describe, expect, it } from "vitest";
import { fetchAllPages } from "@/lib/fetchAllPages";

describe("fetchAllPages", () => {
  it("reads more than 1,000 rows with repeated dates exactly once", async () => {
    // 1,203 rows over only 3 dates; the source orders by date + id like the real queries.
    const source = Array.from({ length: 1203 }, (_, i) => ({
      id: `id-${String(1202 - i).padStart(5, "0")}`,
      transaction_date: `2026-01-0${(i % 3) + 1}`,
    })).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id));
    const calls: Array<[number, number]> = [];
    const rows = await fetchAllPages<{ id: string }>(
      async (from, to) => { calls.push([from, to]); return { data: source.slice(from, to + 1), error: null }; },
      (e) => { throw e; },
    );
    expect(rows).toHaveLength(1203);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1203);
    expect(calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("propagates errors through the service handler", async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { message: "boom" } }), () => { throw new Error("handled"); }))
      .rejects.toThrow("handled");
  });
});
