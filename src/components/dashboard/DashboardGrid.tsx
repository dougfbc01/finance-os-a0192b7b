import type { DashboardWidget } from "@/types";

interface DashboardGridProps {
  widgets: DashboardWidget[];
}

const colSpanClass: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};

/**
 * Grid de widgets do Dashboard. Cada widget é independente e ocupa
 * um número de colunas configurável (1-12). Vazio por padrão.
 */
export function DashboardGrid({ widgets }: DashboardGridProps) {
  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center text-muted-foreground">
        <p className="text-sm">Nenhum widget disponível ainda.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      {widgets.map((widget) => {
        const Widget = widget.component;
        const span = colSpanClass[widget.colSpan ?? 4] ?? colSpanClass[4];
        return (
          <div key={widget.id} className={span}>
            <Widget />
          </div>
        );
      })}
    </div>
  );
}
