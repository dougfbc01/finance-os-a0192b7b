import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiWidgetProps {
  title: string;
  value: number;
  currency?: string;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative";
  suffix?: string;
}

export function KpiWidget({ title, value, currency = "BRL", icon: Icon, tone = "default", suffix }: KpiWidgetProps) {
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "";
  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>
          {suffix ? `${value.toLocaleString("pt-BR")}${suffix}` : formatCurrency(value, currency)}
        </p>
      </CardContent>
    </Card>
  );
}
