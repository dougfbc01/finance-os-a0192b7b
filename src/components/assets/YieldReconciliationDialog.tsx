// YieldReconciliationDialog — Sprint 4.13A
// Conferência de rendimento para ativos ACCOUNT (caixinhas, poupança, renda
// fixa vinculada). Compara o saldo esperado (derivado do ledger) com o saldo
// real informado pelo usuário e sugere o rendimento não explicado.
// Nada é registrado sem confirmação; a criação usa o MovementService.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAccounts } from "@/hooks/useAccounts";
import { useAllMovements } from "@/hooks/useMovements";
import { useCreateMovement } from "@/hooks/useMovements";
import { useCategories, useSubcategories } from "@/hooks/useCategories";
import {
  YieldReconciliationServiceImpl,
  YIELD_TOLERANCE,
} from "@/services/YieldReconciliationService";
import { formatCurrency, formatDate, toISODate } from "@/lib/format";
import type { Asset } from "@/models";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset | null;
}

export function YieldReconciliationDialog({ open, onOpenChange, asset }: Props) {
  const wsId = asset?.workspace_id;
  const { data: accounts = [] } = useAccounts(wsId);
  const { data: movements = [] } = useAllMovements(wsId);
  const { data: categories = [] } = useCategories(wsId);
  const { data: subcategories = [] } = useSubcategories(wsId);
  const createMovement = useCreateMovement();

  const [referenceDate, setReferenceDate] = useState(() => toISODate(new Date()));
  const [realInput, setRealInput] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [subcategoryId, setSubcategoryId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [manual, setManual] = useState(false);

  const account = useMemo(
    () => accounts.find((a) => a.id === asset?.account_id) ?? null,
    [accounts, asset?.account_id],
  );

  const analysis = useMemo(() => {
    if (!asset) return null;
    const expectedOnly = YieldReconciliationServiceImpl.analyze({
      asset,
      account,
      movements,
      referenceDate,
      realBalance: 0,
    });
    const real =
      realInput.trim() === ""
        ? expectedOnly.expectedBalance
        : Number(realInput.replace(",", "."));
    return YieldReconciliationServiceImpl.analyze({
      asset,
      account,
      movements,
      referenceDate,
      realBalance: Number.isFinite(real) ? real : expectedOnly.expectedBalance,
    });
  }, [asset, account, movements, referenceDate, realInput]);

  if (!asset || !analysis) return null;

  const currency = asset.currency;
  const registerAmount =
    amountInput.trim() === "" ? analysis.suggested : Number(amountInput.replace(",", "."));
  const remaining = YieldReconciliationServiceImpl.remaining(
    analysis.difference,
    Number.isFinite(registerAmount) ? registerAmount : 0,
  );

  const subsOfCategory = subcategories.filter(
    (s) => categoryId !== "none" && s.category_id === categoryId,
  );

  async function handleRegister() {
    if (!asset) return;
    const amount = Number.isFinite(registerAmount) ? registerAmount : 0;
    if (amount < YIELD_TOLERANCE) {
      toast.error("Informe um valor de rendimento maior que zero.");
      return;
    }
    try {
      await createMovement.mutateAsync(
        YieldReconciliationServiceImpl.buildYieldInput({
          asset,
          amount,
          date: referenceDate,
          categoryId: categoryId === "none" ? null : categoryId,
          subcategoryId: subcategoryId === "none" ? null : subcategoryId,
          notes: notes.trim() || null,
        }),
      );
      toast.success(`Rendimento de ${formatCurrency(amount, currency)} registrado.`);
      setAmountInput("");
      setRealInput("");
      setNotes("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar rendimento.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conciliação de rendimento</DialogTitle>
          <DialogDescription>
            {asset.name}
            {account ? ` · ${account.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {!analysis.eligible ? (
          <p className="py-4 text-sm text-muted-foreground">
            Este ativo não é conciliável por saldo. A conferência de rendimento está
            disponível apenas para ativos vinculados a uma conta (caixinhas, poupança e
            renda fixa com saldo real conhecido).
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="recon-date">Conferir saldo em</Label>
                <Input
                  id="recon-date"
                  type="date"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recon-real">Saldo real (instituição)</Label>
                <Input
                  id="recon-real"
                  type="number"
                  step="0.01"
                  placeholder={String(analysis.expectedBalance)}
                  value={realInput}
                  onChange={(e) => setRealInput(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Saldo inicial</span>
                <span className="tabular-nums">
                  {formatCurrency(analysis.breakdown.initialBalance, currency)}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Aportes / entradas</span>
                <span className="tabular-nums">
                  {formatCurrency(analysis.breakdown.contributions, currency)}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Resgates / saídas</span>
                <span className="tabular-nums">
                  −{formatCurrency(analysis.breakdown.redemptions, currency)}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Rendimentos já registrados</span>
                <span className="tabular-nums">
                  {formatCurrency(analysis.breakdown.registeredYields, currency)}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-medium">
                <span>Saldo esperado</span>
                <span className="tabular-nums">
                  {formatCurrency(analysis.expectedBalance, currency)}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Saldo real</span>
                <span className="tabular-nums">
                  {formatCurrency(analysis.realBalance, currency)}
                </span>
              </div>
              <div className="flex justify-between py-0.5 font-medium">
                <span>Diferença</span>
                <span
                  className={`tabular-nums ${
                    analysis.status === "YIELD"
                      ? "text-emerald-600"
                      : analysis.status === "UNEXPLAINED"
                        ? "text-red-600"
                        : ""
                  }`}
                >
                  {formatCurrency(analysis.difference, currency)}
                </span>
              </div>
            </div>

            {analysis.status === "NONE" && (
              <p className="text-sm text-muted-foreground">
                Não foi identificado rendimento pendente.
              </p>
            )}
            {analysis.status === "YIELD" && (
              <p className="text-sm font-medium text-emerald-600">
                Possível rendimento de {formatCurrency(analysis.difference, currency)}
              </p>
            )}
            {analysis.status === "UNEXPLAINED" && (
              <p className="text-sm font-medium text-red-600">
                Diferença não explicada de {formatCurrency(analysis.difference, currency)} —
                revise as movimentações antes de registrar qualquer coisa.
              </p>
            )}

            {analysis.hasPendingWarning && (
              <Alert>
                <AlertDescription className="flex flex-col gap-2 text-xs">
                  Existem movimentações não conciliadas que podem explicar parte da
                  diferença ({analysis.breakdown.pendingCount} pendente(s)).
                  {account && (
                    <Link
                      to="/contas/$accountId"
                      params={{ accountId: account.id }}
                      className="underline"
                      onClick={() => onOpenChange(false)}
                    >
                      Abrir extrato da conta
                    </Link>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {analysis.last && (
              <p className="text-xs text-muted-foreground">
                Último rendimento registrado: {formatDate(analysis.last.date)} —{" "}
                {formatCurrency(analysis.last.amount, currency)}
              </p>
            )}

            {(analysis.status === "YIELD" || manual) && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="recon-amount">Valor a registrar</Label>
                    <Input
                      id="recon-amount"
                      type="number"
                      step="0.01"
                      placeholder={String(analysis.suggested)}
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Categoria</Label>
                    <Select
                      value={categoryId}
                      onValueChange={(v) => {
                        setCategoryId(v);
                        setSubcategoryId("none");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {subsOfCategory.length > 0 && (
                  <div className="space-y-1">
                    <Label>Subcategoria</Label>
                    <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem subcategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem subcategoria</SelectItem>
                        {subsOfCategory.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="recon-notes">Observação</Label>
                  <Textarea
                    id="recon-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {remaining !== 0 && (
                  <p className="text-xs text-muted-foreground">
                    Restam {formatCurrency(remaining, currency)} não explicados.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <div className="flex gap-2">
            {analysis.eligible && !manual && analysis.status !== "YIELD" && (
              <Button variant="outline" onClick={() => setManual(true)}>
                Ajustar manualmente
              </Button>
            )}
            {analysis.eligible && (analysis.status === "YIELD" || manual) && (
              <Button onClick={() => void handleRegister()} disabled={createMovement.isPending}>
                {createMovement.isPending ? "Registrando…" : "Registrar rendimento"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
