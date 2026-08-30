// Fundação reutilizável para dialogs longos (Sprint 4.13B).
// Regra de UX: o dialog nunca cresce além do viewport — cabeçalho e rodapé
// ficam fixos e apenas o corpo central rola. Nada de altura fixa no mobile.
import * as React from "react";
import { DialogContent, DialogHeader } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Altura máxima padrão aplicada a todo dialog rolável. */
export const SCROLLABLE_DIALOG_MAX_HEIGHT = "max-h-[90dvh] sm:max-h-[85dvh]";

export const ScrollableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, children, ...props }, ref) => (
  <DialogContent
    ref={ref}
    data-scrollable-dialog=""
    className={cn(
      "flex w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full",
      SCROLLABLE_DIALOG_MAX_HEIGHT,
      className,
    )}
    {...props}
  >
    {children}
  </DialogContent>
));
ScrollableDialogContent.displayName = "ScrollableDialogContent";

export function ScrollableDialogHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn("shrink-0 border-b px-6 pb-4 pt-6 pr-12 text-left", className)}
      {...props}
    />
  );
}

/** Área central: a única com scroll. */
export function ScrollableDialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-dialog-body=""
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4", className)}
      {...props}
    />
  );
}

/** Rodapé fixo — as ações principais nunca saem da área visível. */
export function ScrollableDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-dialog-footer=""
      className={cn(
        "shrink-0 flex flex-col-reverse gap-2 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

/** Bloco temático dentro do corpo (Resumo, Posição, Mercado, Histórico…). */
export function DialogSection({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("border-b py-3 first:pt-0 last:border-b-0 last:pb-0", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
