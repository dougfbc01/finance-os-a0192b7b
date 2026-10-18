import { fetchBrapiHistorical } from "@/lib/marketData.server";
for (const r of [["2025-10-16","2026-10-16"],["2026-04-16","2026-10-16"]]) { const x = await fetchBrapiHistorical("ITSA3",{from:r[0],to:r[1]}); console.log(r, x.status, x.points.length, x.points[0]?.date, x.message); }
