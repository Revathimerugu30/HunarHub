import { Link, useNavigate } from "@tanstack/react-router";
import { useSession, clearToken, dashboardPathFor } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Hammer } from "lucide-react";

export function SiteNavbar() {
  const { session, role, loading } = useSession();
  const navigate = useNavigate();

  function signOut() {
    clearToken();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-sienna text-primary-foreground shadow-warm">
            <Hammer className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            HunarHub
          </span>
        </Link>

        <nav className="hidden gap-8 text-sm font-medium md:flex">
          <Link to="/" className="text-foreground/70 hover:text-primary transition-colors">Home</Link>
          <a href="/#explore" className="text-foreground/70 hover:text-primary transition-colors">Explore</a>
          <a href="/#categories" className="text-foreground/70 hover:text-primary transition-colors">Categories</a>
        </nav>

        <div className="flex items-center gap-2">
          {loading ? null : session ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to={dashboardPathFor(role)}>Dashboard</Link>
              </Button>
              <Button onClick={signOut} variant="outline" size="sm">Sign out</Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                <Link to="/signup" search={{ role: "customer" }}>
                  Sign up
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
