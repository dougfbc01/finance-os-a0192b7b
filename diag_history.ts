import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { investmentHistory } from "@/services/InvestmentAnalysisService";
import { InvestmentServiceImpl } from "@/services/InvestmentService";
import { investmentHistoryDates } from "@/services/InvestmentViewService";
const s = JSON.parse(readFileSync("/root/.cache/lovable-auth/session.json","utf8"));
const c = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { global: { headers: { Authorization: `Bearer ${s.session.access_token}` } }, auth: { persistSession: false } });
async function all(t: string, f?: (q:any)=>any) { const out:any[]=[]; for (let o=0;;o+=1000){ let q=c.from(t).select("*").range(o,o+999); if(f) q=f(q); const {data,error}=await q; if(error) throw error; out.push(...data); if(data.length<1000) break;} return out; }
const assets = (await all("assets")).filter(a=>!a.deleted_at);
const movements = await all("movements");
const prices: Record<string, any[]> = {};
for (const p of await all("market_price_history")) (prices[p.asset_id] ??= []).push({ ticker: p.ticker, date: p.price_date, close: Number(p.close_price), provider: p.provider });
const inv = InvestmentServiceImpl.filterInvestments(assets).filter(a=>a.currency==="BRL");
const dates = investmentHistoryDates("2025-10-16","2026-10-16");
const pts = investmentHistory({ assets: inv, movements, prices, dates });
console.log("assets", inv.length, "movs", movements.length, "nullTotal", pts.filter(p=>p.value==null).length, "/", pts.length);
const reasons = new Map<string,Set<string>>();
for (const p of pts) for (const l of p.limitations) { const k=l.reason; (reasons.get(k) ?? reasons.set(k,new Set()).get(k)!).add(l.name); }
for (const [k,v] of reasons) console.log(k, v.size, [...v].join(", "));
for (const d of ["2025-10-16","2026-03-01","2026-07-10","2026-10-16"]) { const p = pts.find(x=>x.date===d)!; console.log(d, p.value, JSON.stringify(p.valuesByGroup), p.missingAssets); }
