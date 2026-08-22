// Sprint 4.10 — chamada server-side ao provider de mercado.
// Fica no servidor para que qualquer credencial (BRAPI_TOKEN) nunca vá ao browser.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchBrapiQuote } from "./marketData.server";

export const lookupTickerFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ticker: z.string().min(1).max(20) }))
  .handler(async ({ data }) => fetchBrapiQuote(data.ticker));
