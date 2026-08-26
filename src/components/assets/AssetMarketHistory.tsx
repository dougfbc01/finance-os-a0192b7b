// Sprint 4.12 — seção "Histórico de mercado" no detalhe do ativo.
// O gráfico usa EXCLUSIVAMENTE os preços históricos de mercado (fechamento
// diário); custo histórico da posição não é misturado na série.
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  MARKET_HISTORY_PERIOD_LABELS,
  useMarketPriceHistory,
  type MarketHistoryPeriod,
} from "@/hooks/useMarketPriceHistory";
import { formatCurrency, formatDate } from "@/lib/format";
import type { UUID } from "@/models";

interface Props {
  asset: { id: UUID; workspace_id: UUID; ticker?: string | null };
  currency: string;
}

const PERIODS: MarketHistoryPeriod[] = ["1M", "3M", "6M", "1A", "MAX"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function AssetMarketHistory({ asset, currency }: Props) {
  const [period, setPeriod] = useState<MarketHistoryPeriod>("3M");
  const { points, stats, status, message, isLoading } = useMarketPriceHistory(
    asset,
    period,
    true,
  );

  return (
    <div className="py-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Histórico de mercado</p>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={period === p ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setPeriod(p)}
            >
              {MARKET_HISTORY_PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Carregando histórico…
        </p>
      ) : !stats ? (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Histórico de mercado indisponível
          {status && status !== "OK" && message ? ` — ${message}` : "."}
        </p>
      ) : (
        <>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => formatDate(d).slice(0, 5)}
                  tick={{ fontSize: 10 }}
                  minTickGap={32}
                />
                <YAxis
                  dataKey="close"
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10 }}
                  width={56}
                  tickFormatter={(v: number) =>
                    v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                  }
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value), currency), "Fechamento"]}
                  labelFormatter={(d) => formatDate(String(d))}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  dot={false}
                  strokeWidth={2}
                  className="stroke-primary"
                  stroke="currentColor"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2">
            <Stat
              label="Período"
              value={`${formatDate(stats.realFrom)} — ${formatDate(stats.realTo)} (${stats.count} pregões)`}
            />
            <Stat label="Primeira cotação" value={formatCurrency(stats.first.close, currency)} />
            <Stat label="Última cotação" value={formatCurrency(stats.last.close, currency)} />
            <Stat label="Maior cotação" value={formatCurrency(stats.high, currency)} />
            <Stat label="Menor cotação" value={formatCurrency(stats.low, currency)} />
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-muted-foreground">Variação no período</span>
              <span
                className={`tabular-nums font-medium ${
                  stats.change >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {stats.change >= 0 ? "+" : ""}
                {formatCurrency(stats.change, currency)} ({stats.changePercent >= 0 ? "+" : ""}
                {stats.changePercent.toFixed(2)}%)
              </span>
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">
              Preços de fechamento diário ({points[0]?.provider ?? "provider"}). Série exclusiva
              de mercado — não inclui custo histórico nem movimentações.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
