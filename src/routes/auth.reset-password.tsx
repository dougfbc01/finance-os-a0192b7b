import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/auth/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nova senha — Finance OS" }] }),
  component: ResetPasswordPage,
});

const schema = z.object({ password: z.string().min(6, "Mínimo 6 caracteres") });
type Values = z.infer<typeof schema>;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  const onSubmit = async (values: Values) => {
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada com sucesso!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Definir nova senha</CardTitle>
          <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" type="password" {...form.register("password")} />
              {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Salvar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
