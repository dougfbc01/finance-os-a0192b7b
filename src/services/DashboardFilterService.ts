// DashboardFilterService — resolução centralizada do filtro global de período.
// REGRA: nenhum widget/hook pode calcular datas por conta própria.
// Todo período do Dashboard passa obrigatoriamente por este Service.
import { BaseService } from "./BaseService";
import { DashboardPeriod } from "@/constants/dashboard";
import { toISODate } from "@/lib/format";

export interface DateRange {
  /** yyyy-mm-dd (inclusive) */
  start: string;
  /** yyyy-mm-dd (inclusive) */
  end: string;
}

export interface ResolvedPeriod extends DateRange {
  period: DashboardPeriod;
  label: string;
  /** Meses (yyyy-mm) cobertos pelo intervalo, em ordem cronológica. */
  months: string[];
  /** Período imediatamente anterior, de mesma duração em meses. */
  previous: DateRange;
}

export interface CustomRangeInput {
  start?: string | null;
  end?: string | null;
}

class DashboardFilterServiceImpl extends BaseService {
  private startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private endOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  private monthsBetween(start: Date, end: Date): string[] {
    const out: string[] = [];
    const cursor = this.startOfMonth(start);
    while (cursor <= end) {
      out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }

  /** Rótulo legível do intervalo (usado nos títulos/legendas dos widgets). */
  formatRangeLabel(range: DateRange): string {
    const fmt = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    return `${fmt(range.start)} — ${fmt(range.end)}`;
  }

  /** Rótulo curto de um mês (yyyy-mm) para eixos de gráficos. */
  monthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    });
  }

  /** Resolve o período selecionado em datas concretas + período anterior comparável. */
  resolve(
    period: DashboardPeriod,
    custom?: CustomRangeInput,
    reference: Date = new Date(),
  ): ResolvedPeriod {
    let start: Date;
    let end: Date;

    switch (period) {
      case DashboardPeriod.LAST_MONTH: {
        const ref = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
        start = this.startOfMonth(ref);
        end = this.endOfMonth(ref);
        break;
      }
      case DashboardPeriod.LAST_3_MONTHS:
      case DashboardPeriod.LAST_6_MONTHS:
      case DashboardPeriod.LAST_12_MONTHS: {
        const size =
          period === DashboardPeriod.LAST_3_MONTHS
            ? 3
            : period === DashboardPeriod.LAST_6_MONTHS
              ? 6
              : 12;
        start = this.startOfMonth(
          new Date(reference.getFullYear(), reference.getMonth() - (size - 1), 1),
        );
        end = this.endOfMonth(reference);
        break;
      }
      case DashboardPeriod.CURRENT_YEAR: {
        start = new Date(reference.getFullYear(), 0, 1);
        end = new Date(reference.getFullYear(), 11, 31);
        break;
      }
      case DashboardPeriod.PREVIOUS_YEAR: {
        start = new Date(reference.getFullYear() - 1, 0, 1);
        end = new Date(reference.getFullYear() - 1, 11, 31);
        break;
      }
      case DashboardPeriod.CUSTOM: {
        const s = custom?.start ? new Date(`${custom.start}T00:00:00`) : this.startOfMonth(reference);
        const e = custom?.end ? new Date(`${custom.end}T00:00:00`) : this.endOfMonth(reference);
        start = s <= e ? s : e;
        end = s <= e ? e : s;
        break;
      }
      case DashboardPeriod.CURRENT_MONTH:
      default: {
        start = this.startOfMonth(reference);
        end = this.endOfMonth(reference);
        break;
      }
    }

    const months = this.monthsBetween(start, end);
    const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

    // Período anterior comparável: mesma quantidade de meses quando o intervalo é
    // fechado em meses; caso contrário, mesma quantidade de dias (custom livre).
    let prevStart: Date;
    let prevEnd: Date;
    const isWholeMonths =
      start.getDate() === 1 && end.getTime() === this.endOfMonth(end).getTime();
    if (isWholeMonths) {
      const size = months.length;
      prevStart = this.startOfMonth(new Date(start.getFullYear(), start.getMonth() - size, 1));
      prevEnd = this.endOfMonth(new Date(end.getFullYear(), end.getMonth() - size, 1));
    } else {
      prevEnd = new Date(start.getTime() - 86_400_000);
      prevStart = new Date(prevEnd.getTime() - (spanDays - 1) * 86_400_000);
    }

    const range: DateRange = { start: toISODate(start), end: toISODate(end) };

    return {
      period,
      ...range,
      label: this.formatRangeLabel(range),
      months,
      previous: { start: toISODate(prevStart), end: toISODate(prevEnd) },
    };
  }

  /** Verifica se uma data (yyyy-mm-dd) está dentro do intervalo (inclusive). */
  contains(range: DateRange, isoDate: string | null | undefined): boolean {
    if (!isoDate) return false;
    const d = isoDate.slice(0, 10);
    return d >= range.start && d <= range.end;
  }
}

export const DashboardFilterService = new DashboardFilterServiceImpl();
export { DashboardFilterServiceImpl };
