import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Finance OS" },
      { name: "description", content: "Acesse sua conta no Finance OS." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const signUpSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Finance OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sua vida financeira, organizada.</p>
        </div>
        <Card>
          <Tabs defaultValue="signin">
            <CardHeader>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="signin"><SignInForm /></TabsContent>
              <TabsContent value="signup"><SignUpForm /></TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Erro ao entrar com Google");
      setLoading(false);
    }
  };
  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
      Continuar com Google
    </Button>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (values: SignInValues) => {
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">E-mail</Label>
        <Input id="signin-email" type="email" {...form.register("email")} />
        {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Senha</Label>
        <Input id="signin-password" type="password" {...form.register("password")} />
        {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Entrar</Button>
      <GoogleButton />
      <div className="text-center text-sm">
        <Link to="/auth/forgot-password" className="text-muted-foreground hover:text-foreground">Esqueci minha senha</Link>
      </div>
    </form>
  );
}

function SignUpForm() {
  const navigate = useNavigate();
  const form = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema), defaultValues: { name: "", email: "", password: "" } });

  const onSubmit = async (values: SignUpValues) => {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: values.name },
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Conta criada!");
      navigate({ to: "/dashboard", replace: true });
    } else {
      toast.success("Verifique seu e-mail para confirmar o cadastro.");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Nome</Label>
        <Input id="signup-name" {...form.register("name")} />
        {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">E-mail</Label>
        <Input id="signup-email" type="email" {...form.register("email")} />
        {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha</Label>
        <Input id="signup-password" type="password" {...form.register("password")} />
        {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Cadastrar</Button>
      <GoogleButton />
    </form>
  );
}
