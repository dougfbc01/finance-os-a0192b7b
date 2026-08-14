import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { PatrimonyComposition, CompositionItem } from "@/services/PatrimonyService";

interface Props {
  title?: string;
  composition: PatrimonyComposition;
  /** Drill-down até o ativo (opcional). */
  onSelectAsset?: (assetId: string) => void;
}

export function PatrimonyCompositionWidget({
  title = "Composição do Patrimônio",
  composition,
  onSelectAsset,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {composition.buckets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum saldo ou ativo registrado ainda.
          </p>
        ) : (
          <div className="divide-y">
            {composition.buckets.map((b) => {
              const expanded = open === b.key;
              return (
                <div key={b.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : b.key)}
                    className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted/50"
                    aria-expanded={expanded}
                  >
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        expanded ? "rotate-90" : ""
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {b.percent.toFixed(1)}%
                    </span>
                    <span className="w-32 text-right text-sm tabular-nums">
                      {formatCurrency(b.amount)}
                    </span>
                  </button>

                  {expanded && (
                    <ul className="pb-2 pl-7">
                      {b.items.map((item: CompositionItem) => (
                        <li
                          key={`${b.key}-${item.id}`}
                          className="flex items-center gap-3 py-1.5 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {item.assetId && onSelectAsset ? (
                              <Button
                                variant="link"
                                className="h-auto p-0 text-sm"
                                onClick={() => onSelectAsset(item.assetId as string)}
                              >
                                {item.label}
                              </Button>
                            ) : (
                              item.label
                            )}
                            {item.sublabel && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {item.sublabel}
                              </span>
                            )}
                          </span>
                          <span className="w-32 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(item.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-3 text-sm font-semibold">
              <span>Patrimônio bruto</span>
              <span className="tabular-nums">{formatCurrency(composition.total)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
