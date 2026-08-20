import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layouts";
import { AccessGate } from "@/components/admin";
import { ROUTES } from "@/constants";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: ROUTES.AUTH });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <MainLayout>
      <AccessGate>
        <Outlet />
      </AccessGate>
    </MainLayout>
  );
}

