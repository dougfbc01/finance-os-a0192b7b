import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Ban, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { ROUTES } from "@/constants";
import { useMyAccess } from "@/hooks/useAdmin";
import { AdminService } from "@/services/AdminService";

/**
 * Bloqueia áreas protegidas para usuários PENDING/BLOCKED.
 * Não exclui nem altera nenhum dado do usuário — apenas impede o uso.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { status, isLoading } = useMyAccess();
  const navigate = useNavigate();

  if (isLoading) return <>{children}</>;
  if (AdminService.canUseApp(status)) return <>{children}</>;

  const blocked = status === "BLOCKED";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: ROUTES.AUTH, replace: true });
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {blocked ? <Ban className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            {blocked ? "Acesso bloqueado" : "Acesso pendente de liberação"}
          </CardTitle>
          <CardDescription>
            {blocked
              ? "Sua conta foi bloqueada pelo administrador. Seus dados e histórico foram preservados."
              : "Sua conta foi criada e aguarda liberação do administrador do Finance OS."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
