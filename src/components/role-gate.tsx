import { Navigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { useSession, type AppRole, dashboardPathFor } from "@/lib/auth";

export function RoleGate({ allow, children }: { allow: AppRole; children: ReactNode }) {
  const { user, role, loading } = useSession();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (role !== allow) return <Navigate to={dashboardPathFor(role)} />;
  return <>{children}</>;
}
