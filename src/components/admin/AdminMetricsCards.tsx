import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminOverview } from "@/models/Admin";

interface Props {
  overview: AdminOverview;
}

interface Metric {
  label: string;
  value: number;
  hint?: string;
}

export function AdminMetricsCards({ overview }: Props) {
  const identity: Metric[] = [
    { label: "Usuários cadastrados", value: overview.totalUsers },
    { label: "Ativos", value: overview.active },
    { label: "Pendentes", value: overview.pending },
    { label: "Bloqueados", value: overview.blocked },
    { label: "Administradores", value: overview.admins },
  ];

  const saas: Metric[] = [
    { label: "Assinaturas ativas", value: overview.subscriptionsActive },
    { label: "Trials", value: overview.trials },
    { label: "Vencendo em 15 dias", value: overview.expiringSoon },
    { label: "Canceladas", value: overview.canceled },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {identity.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs text-muted-foreground">
          Indicadores de assinatura (estrutura preparada — sem cobrança nesta fase). Somente
          dados reais já registrados.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {saas.map((m) => (
            <Card key={m.label} className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {m.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{m.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
