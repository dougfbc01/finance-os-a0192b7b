import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  CreditCard,
  TrendingUp,
  Landmark,
  Target,
  Goal,
  FileBarChart,
  Settings,
  LogOut,
  Tags,
  Upload,
  Shuffle,
  Sparkles,
  CopyCheck,
  CalendarCheck,
} from "lucide-react";
import { APP_NAME, ROUTES } from "@/constants";
import type { NavItem } from "@/types";

const navItems: NavItem[] = [
  { title: "Dashboard", url: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { title: "Contas", url: ROUTES.CONTAS, icon: Wallet },
  { title: "Categorias", url: ROUTES.CATEGORIAS, icon: Tags },
  { title: "Movimentações", url: ROUTES.MOVIMENTACOES, icon: ArrowLeftRight },
  { title: "Transf. Pendentes", url: ROUTES.TRANSFERENCIAS_PENDENTES, icon: Shuffle },
  { title: "Importações", url: ROUTES.IMPORTACOES, icon: Upload },
  { title: "Regras", url: ROUTES.REGRAS, icon: Sparkles },
  { title: "Duplicidades", url: ROUTES.DUPLICIDADES, icon: CopyCheck },
  { title: "Cartões", url: ROUTES.CARTOES, icon: CreditCard },
  { title: "Investimentos", url: ROUTES.INVESTIMENTOS, icon: TrendingUp },
  { title: "Patrimônio", url: ROUTES.PATRIMONIO, icon: Landmark },
  { title: "Fechamentos", url: ROUTES.FECHAMENTOS, icon: CalendarCheck },
  { title: "Planejamento", url: ROUTES.PLANEJAMENTO, icon: Target },
  { title: "Metas", url: ROUTES.METAS, icon: Goal },
  { title: "Relatórios", url: ROUTES.RELATORIOS, icon: FileBarChart },
  { title: "Configurações", url: ROUTES.CONFIGURACOES, icon: Settings },
];

function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: ROUTES.AUTH, replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-4">
          <h1 className="text-lg font-bold tracking-tight">{APP_NAME}</h1>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start">
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-background px-4 gap-2">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">{APP_NAME}</div>
          </header>
          <main className="flex-1 p-6 bg-muted/20">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
