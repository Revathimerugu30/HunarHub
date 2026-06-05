import { Link, useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Hammer, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

interface NavItem { to?: string; label: string; icon: React.ComponentType<{ className?: string }>; onClick?: () => void; active?: boolean }

export function DashboardShell({
  title,
  navItems,
  children,
}: {
  title: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  const navigate = useNavigate();

  function signOut() {
    clearToken();
    navigate({ to: "/" });
  }

  const renderNav = (n: NavItem) => {
    const baseCls = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition";
    const activeCls = n.active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
    const cls = `${baseCls} ${activeCls}`;
    const inner = (
      <>
        <n.icon className="h-4 w-4 text-sidebar-primary" />
        {n.label}
      </>
    );
    if (n.to?.startsWith("/")) {
      return (
        <Link key={n.label} to={n.to} className={cls} activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
          {inner}
        </Link>
      );
    }
    if (n.onClick) {
      return (
        <button key={n.label} type="button" onClick={n.onClick} className={cls}>
          {inner}
        </button>
      );
    }
    return (
      <span key={n.label} className={cls}>{inner}</span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Hammer className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">HunarHub</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <div className="px-3 pt-3 pb-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/60">
            {title}
          </div>
          {navItems.map(renderNav)}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2 md:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Hammer className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">HunarHub</span>
          </Link>
          <div className="hidden text-sm text-muted-foreground md:block">{title} dashboard</div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button onClick={signOut} variant="ghost" size="sm" className="md:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2 md:hidden">
          {navItems.map((n) => renderNav(n))}
        </nav>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
