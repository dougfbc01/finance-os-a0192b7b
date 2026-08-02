// Hook do filtro global do Dashboard.
// Mantém apenas o ESTADO da seleção — a resolução das datas é 100% do
// DashboardFilterService (nenhum cálculo de data vive aqui).
import { useMemo, useState, useCallback } from "react";
import {
  DashboardPeriod,
  DEFAULT_DASHBOARD_PERIOD,
} from "@/constants/dashboard";
import {
  DashboardFilterService,
  type CustomRangeInput,
  type ResolvedPeriod,
} from "@/services/DashboardFilterService";

export interface DashboardFilterState {
  period: DashboardPeriod;
  custom: CustomRangeInput;
  resolved: ResolvedPeriod;
  setPeriod: (period: DashboardPeriod) => void;
  setCustom: (custom: CustomRangeInput) => void;
}

export function useDashboardFilter(
  initialPeriod: DashboardPeriod = DEFAULT_DASHBOARD_PERIOD,
): DashboardFilterState {
  const [period, setPeriod] = useState<DashboardPeriod>(initialPeriod);
  const [custom, setCustom] = useState<CustomRangeInput>({ start: null, end: null });

  const resolved = useMemo(
    () => DashboardFilterService.resolve(period, custom),
    [period, custom],
  );

  const handleSetCustom = useCallback((next: CustomRangeInput) => {
    setCustom(next);
    setPeriod(DashboardPeriod.CUSTOM);
  }, []);

  return { period, custom, resolved, setPeriod, setCustom: handleSetCustom };
}
