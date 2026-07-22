import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil } from "lucide-react";
import type { Account } from "@/models";
import { ACCOUNT_TYPE_LABELS } from "@/constants";
import { getAccountIcon } from "@/lib/account-icons";
import { formatCurrency } from "@/lib/format";

interface AccountCardProps {
  account: Account;
  balance?: number;
  onEdit: (account: Account) => void;
  onToggleActive: (account: Account, next: boolean) => void;
  toggling?: boolean;
}

export function AccountCard({ account, balance, onEdit, onToggleActive, toggling }: AccountCardProps) {
  const Icon = getAccountIcon(account.icon);
  const currentBalance = balance ?? Number(account.initial_balance);
  return (
    <Card className={account.is_active ? "" : "opacity-60"}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: account.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{account.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {account.institution || "—"}
                </p>
              </div>
              <Badge variant="secondary" className="whitespace-nowrap">
                {ACCOUNT_TYPE_LABELS[account.account_type]}
              </Badge>
            </div>

            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Saldo atual</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(currentBalance, account.currency)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Inicial: {formatCurrency(Number(account.initial_balance), account.currency)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {account.is_active ? "Ativa" : "Inativa"}
                </span>
                <Switch
                  checked={account.is_active}
                  disabled={toggling}
                  onCheckedChange={(v) => onToggleActive(account, v)}
                  aria-label="Ativar/desativar conta"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => onEdit(account)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Editar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
