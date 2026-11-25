import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { TAB } from "@/lib/routes";
import type { User as UserType } from "@shared/schema";

// Mismo shell que arma home.tsx (Header + sidebar/bottom-nav + main). Paginas
// standalone que no pasan por home.tsx (p.ej. /tutor/:id via URL directa) lo
// (sin barra inferior movil: es una vista de detalle) usan para no perder el sidebar izquierdo ni los estilos del dashboard.
export function DashboardLayout({ activeTab, children }: { activeTab: string; children: ReactNode }) {
  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/user/current"],
  });

  return (
    <div className="flex min-h-dvh w-full flex-col bg-white lg:h-screen lg:overflow-hidden">
      {activeTab === TAB.home ? <Header /> : <div aria-hidden className="h-safe-top shrink-0 lg:hidden" />}
      {/* Mismo grid que `.shell-grid` de home.tsx (12 columnas, max-w-shell, gap-6): menu 2 + contenido 10, con lineas laterales. */}
      <div className="shell-grid flex flex-1 flex-col lg:mx-auto lg:grid lg:min-h-0 lg:w-full lg:max-w-shell lg:grid-cols-12 lg:grid-rows-1 lg:gap-6 lg:px-6">
        <BottomNavigation activeTab={activeTab} onTabChange={() => {}} userType={(currentUser as any)?.userType} hideMobileBar />
        <main className="flex-1 lg:col-span-10 lg:min-h-0 lg:h-full lg:min-w-0 lg:overflow-y-auto lg:border-x lg:border-border scrollbar-none">
          {children}
        </main>
      </div>
    </div>
  );
}
