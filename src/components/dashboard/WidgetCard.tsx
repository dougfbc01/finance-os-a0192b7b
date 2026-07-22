import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WidgetCardProps {
  title: string;
  children?: ReactNode;
}

/**
 * Container padrão para um widget do Dashboard.
 * Widgets independentes se renderizam dentro dele via DashboardGrid.
 */
export function WidgetCard({ title, children }: WidgetCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
