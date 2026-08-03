import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FinancialInsight, InsightLevel } from "@/models/Insight";

const LEVEL_META: Record<
  InsightLevel,
  { label: string; icon: typeof Info; className: string; badge: "default" | "secondary" | "destructive" }
> = {
  CRITICAL: {
    label: "Crítico",
    icon: ShieldAlert,
    className: "text-destructive",
    badge: "destructive",
  },
  WARNING: {
    label: "Atenção",
    icon: AlertTriangle,
    className: "text-amber-500",
    badge: "default",
  },
  INFO: { label: "Info", icon: Info, className: "text-muted-foreground", badge: "secondary" },
};

interface Props {
  insights: FinancialInsight[];
  limit?: number;
}

/** Widget de Financial Insights — apenas apresentação (ordenação vem do Service). */
export function FinancialInsightsWidget({ insights, limit = 6 }: Props) {
  const visible = insights.slice(0, limit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Financial Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum insight relevante para o período selecionado.
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((insight) => {
              const meta = LEVEL_META[insight.level];
              const Icon = meta.icon;
              return (
                <li key={insight.id} className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{insight.title}</span>
                      <Badge variant={meta.badge} className="text-[10px]">
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
