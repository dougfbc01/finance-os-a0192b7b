// Constantes do Dashboard — opções do filtro global de período.
// Nenhum widget deve declarar períodos próprios: sempre usar estes valores
// e resolvê-los através do DashboardFilterService.

export enum DashboardPeriod {
  CURRENT_MONTH = "CURRENT_MONTH",
  LAST_MONTH = "LAST_MONTH",
  LAST_3_MONTHS = "LAST_3_MONTHS",
  LAST_6_MONTHS = "LAST_6_MONTHS",
  LAST_12_MONTHS = "LAST_12_MONTHS",
  CURRENT_YEAR = "CURRENT_YEAR",
  PREVIOUS_YEAR = "PREVIOUS_YEAR",
  CUSTOM = "CUSTOM",
}

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  [DashboardPeriod.CURRENT_MONTH]: "Mês atual",
  [DashboardPeriod.LAST_MONTH]: "Mês passado",
  [DashboardPeriod.LAST_3_MONTHS]: "Últimos 3 meses",
  [DashboardPeriod.LAST_6_MONTHS]: "Últimos 6 meses",
  [DashboardPeriod.LAST_12_MONTHS]: "Últimos 12 meses",
  [DashboardPeriod.CURRENT_YEAR]: "Ano atual",
  [DashboardPeriod.PREVIOUS_YEAR]: "Ano anterior",
  [DashboardPeriod.CUSTOM]: "Personalizado",
};

export const DASHBOARD_PERIOD_OPTIONS = Object.values(DashboardPeriod);

export const DEFAULT_DASHBOARD_PERIOD = DashboardPeriod.CURRENT_MONTH;
