// Sprint 4.10/4.11 — chamadas server-side ao provider de mercado.
// Ficam no servidor para que qualquer credencial (BRAPI_TOKEN) nunca vá ao browser.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchBrapiQuote, fetchBrapiQuotes } from "./marketData.server";

export const lookupTickerFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ticker: z.string().min(1).max(20) }))
  .handler(async ({ data }) => fetchBrapiQuote(data.ticker));

export const quoteTickersFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ tickers: z.array(z.string().min(1).max(20)).max(50) }))
  .handler(async ({ data }) => fetchBrapiQuotes(data.tickers));
