import { Button } from "@/components/ui/button";
import { MONTH_LABELS } from "@/models/MonthlyClosing";
import { MONTH_STATUS_LABELS } from "@/components/reports/MonthlySummaryReport";
import type { MonthGridCell } from "@/services/MonthlySummaryService";

export function MonthGrid({ cells, selectedKey, onSelect }: { cells: MonthGridCell[]; selectedKey: string; onSelect: (c: MonthGridCell) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {cells.map((c) => (
        <Button key={c.key} variant={c.key === selectedKey ? "default" : "outline"} className="h-auto flex-col items-start py-2"
          onClick={() => onSelect(c)}>
          <span className="font-medium">{MONTH_LABELS[c.month - 1].slice(0, 3)} {c.year}</span>
          <span className={`text-xs ${c.status === "STALE" ? "text-destructive" : "opacity-70"}`}>{MONTH_STATUS_LABELS[c.status]}</span>
        </Button>
      ))}
    </div>
  );
}
