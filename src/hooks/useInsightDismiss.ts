// Persistência do "marcar como lido" dos insights.
// Regra: o dismiss é atrelado à ASSINATURA do problema — se o problema mudar
// (ou voltar a existir), o insight reaparece automaticamente.
import { useCallback, useEffect, useState } from "react";
import type { FinancialInsight } from "@/models/Insight";

const STORAGE_KEY = "finance-os:insights:dismissed";

type DismissMap = Record<string, string>; // id -> signature

function read(): DismissMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DismissMap) : {};
  } catch {
    return {};
  }
}

export function useInsightDismiss() {
  const [map, setMap] = useState<DismissMap>({});

  useEffect(() => {
    setMap(read());
  }, []);

  const persist = useCallback((next: DismissMap) => {
    setMap(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage indisponível — dismiss vira apenas em memória */
    }
  }, []);

  const dismiss = useCallback(
    (insight: FinancialInsight) => {
      if (!insight.dismissible) return;
      persist({ ...map, [insight.id]: insight.signature });
    },
    [map, persist],
  );

  const restoreAll = useCallback(() => persist({}), [persist]);

  const isDismissed = useCallback(
    (insight: FinancialInsight) =>
      insight.dismissible && map[insight.id] === insight.signature,
    [map],
  );

  return { dismiss, restoreAll, isDismissed };
}
