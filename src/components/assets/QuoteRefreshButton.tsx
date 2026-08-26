// Sprint 4.12 — botão "Atualizar cotações" com cooldown de 30 minutos e
// transparência sobre a política de atualização (última / próxima automática).
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";

interface Props {
  isFetching: boolean;
  /** Epoch ms da última atualização bem-sucedida (null = nunca). */
  updatedAt: number | null;
  /** Cooldown manual ativo até este epoch ms (null = liberado). */
  cooldownUntil: number | null;
  /** Próxima atualização automática previsível (null = indeterminado). */
  nextAutoUpdate: Date | null;
  onRefresh: () => void;
}

export function QuoteRefreshButton({
  isFetching,
  updatedAt,
  cooldownUntil,
  nextAutoUpdate,
  onRefresh,
}: Props) {
  const blocked = cooldownUntil !== null;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onRefresh} disabled={isFetching || blocked}>
          <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar cotações
        </Button>
        <span className="text-xs text-muted-foreground">
          {updatedAt
            ? `Última atualização: ${formatDateTime(new Date(updatedAt))}`
            : "Nunca atualizado"}
        </span>
      </div>
      {blocked ? (
        <span className="text-xs text-muted-foreground">
          Cotações atualizadas há poucos minutos. Nova consulta disponível às{" "}
          {new Date(cooldownUntil).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </span>
      ) : nextAutoUpdate ? (
        <span className="text-xs text-muted-foreground">
          Próxima atualização automática: {formatDate(nextAutoUpdate)}
        </span>
      ) : null}
    </div>
  );
}
