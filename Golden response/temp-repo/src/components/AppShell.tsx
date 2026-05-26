import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Boxes, ScanLine, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const navItem = (to: string, icon: React.ReactNode, label: string) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Boxes className="h-5 w-5" />
              WMS
            </div>
            <nav className="flex items-center gap-1">
              {navItem("/", <LayoutDashboard className="h-4 w-4" />, "Dashboard")}
              {navItem("/receive", <ScanLine className="h-4 w-4" />, "Receive")}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {email && <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-1 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
