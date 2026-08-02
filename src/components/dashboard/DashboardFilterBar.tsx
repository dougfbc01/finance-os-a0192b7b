// Filtro global do Dashboard. Componente puramente de apresentação:
// a resolução das datas é feita pelo DashboardFilterService via hook.
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DashboardPeriod,
  DASHBOARD_PERIOD_LABELS,
  DASHBOARD_PERIOD_OPTIONS,
} from "@/constants/dashboard";
import type { DashboardFilterState } from "@/hooks/useDashboardFilter";

export function DashboardFilterBar({ filter }: { filter: DashboardFilterState }) {
  const { period, custom, resolved, setPeriod, setCustom } = filter;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Período
          </div>

          <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {DASHBOARD_PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {period === DashboardPeriod.CUSTOM && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="Data inicial"
                className="w-[150px]"
                value={custom.start ?? resolved.start}
                onChange={(e) => setCustom({ ...custom, start: e.target.value })}
              />
              <span className="text-muted-foreground">até</span>
              <Input
                type="date"
                aria-label="Data final"
                className="w-[150px]"
                value={custom.end ?? resolved.end}
                onChange={(e) => setCustom({ ...custom, end: e.target.value })}
              />
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{resolved.label}</p>
      </CardContent>
    </Card>
  );
}
