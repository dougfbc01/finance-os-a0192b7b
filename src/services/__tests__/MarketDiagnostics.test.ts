// Sprint 4.11.1 — diagnóstico da integração BRAPI. fetch sempre mockado.
import { describe, it, expect, vi, afterEach } from "vitest";
import { diagnoseBrapi, fetchBrapiQuotes } from "@/lib/marketData.server";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

const priceBody = (symbol: string, price: number) => ({
  results: [{ symbol, regularMarketPrice: price, currency: "BRL" }],
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["BRAPI_TOKEN"];
});

describe("diagnoseBrapi", () => {
  it("sem token: 401 MISSING_TOKEN vira NOT_CONFIGURED", async () => {
    vi.stubGlobal("fetch", mockFetch(401, { code: "MISSING_TOKEN" }));
    const d = await diagnoseBrapi("WEGE3");
    expect(d.status).toBe("NOT_CONFIGURED");
    expect(d.tokenConfigured).toBe(false);
    expect(d.message).toContain("BRAPI_TOKEN");
  });

  it("com token válido: cotação recebida", async () => {
    process.env["BRAPI_TOKEN"] = "s3cr3tvalue";
    vi.stubGlobal("fetch", mockFetch(200, priceBody("WEGE3", 42.5)));
    const d = await diagnoseBrapi("WEGE3");
    expect(d.status).toBe("OK");
    expect(d.price).toBe(42.5);
    expect(d.tokenConfigured).toBe(true);
    expect(JSON.stringify(d)).not.toContain("s3cr3tvalue");
  });

  it("token inválido (401 com token configurado) vira INVALID_TOKEN", async () => {
    process.env["BRAPI_TOKEN"] = "s3cr3tvalue";
    vi.stubGlobal("fetch", mockFetch(401, { code: "INVALID_TOKEN" }));
    const d = await diagnoseBrapi("WEGE3");
    expect(d.status).toBe("INVALID_TOKEN");
  });

  it("403 com token configurado vira INVALID_TOKEN", async () => {
    process.env["BRAPI_TOKEN"] = "s3cr3tvalue";
    vi.stubGlobal("fetch", mockFetch(403, { code: "FORBIDDEN" }));
    const d = await diagnoseBrapi("WEGE3");
    expect(d.status).toBe("INVALID_TOKEN");
  });

  it("timeout vira TIMEOUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }),
    );
    const d = await diagnoseBrapi("WEGE3");
    expect(d.status).toBe("TIMEOUT");
  });

  it("ticker inexistente vira NOT_FOUND", async () => {
    vi.stubGlobal("fetch", mockFetch(404, { error: true }));
    const d = await diagnoseBrapi("XXXX9");
    expect(d.status).toBe("NOT_FOUND");
  });

  it("500 vira UNAVAILABLE", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}));
    const d = await diagnoseBrapi("WEGE3");
    expect(d.status).toBe("UNAVAILABLE");
  });
});

describe("fetchBrapiQuotes", () => {
  it("consulta 1 ticker por requisição (limite do provider) e agrega os resultados", async () => {
    process.env["BRAPI_TOKEN"] = "s3cr3tvalue";
    const prices: Record<string, number> = { WEGE3: 40, PETR4: 44.3 };
    const f = vi.fn(async (input: string) => {
      const symbol = decodeURIComponent(new URL(input).pathname.split("/").pop() ?? "");
      expect(symbol).not.toContain(",");
      const price = prices[symbol];
      const body =
        price === undefined ? { results: [] } : priceBody(symbol, price);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", f);
    const res = await fetchBrapiQuotes(["WEGE3", "PETR4", "ABCB4"]);
    expect(res.status).toBe("OK");
    expect(f).toHaveBeenCalledTimes(3);
    expect(res.quotes.map((q) => q.symbol).sort()).toEqual(["PETR4", "WEGE3"]);
  });


  it("401 sem token vira NOT_CONFIGURED com mensagem tratada", async () => {
    vi.stubGlobal("fetch", mockFetch(401, { code: "MISSING_TOKEN" }));
    const res = await fetchBrapiQuotes(["WEGE3", "ABCB4"]);
    expect(res.status).toBe("NOT_CONFIGURED");
    expect(res.quotes).toEqual([]);
    expect(res.message).toContain("BRAPI_TOKEN");
  });

  it("lista vazia não chama o provider", async () => {
    const f = mockFetch(200, {});
    vi.stubGlobal("fetch", f);
    const res = await fetchBrapiQuotes([]);
    expect(res.status).toBe("OK");
    expect(f).not.toHaveBeenCalled();
  });
});
