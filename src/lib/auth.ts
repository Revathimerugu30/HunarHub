import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type AppRole = "admin" | "artisan" | "customer";

export interface AuthUser {
  _id: string;
  email: string;
  full_name: string;
  role: AppRole;
  city?: string;
}

export interface SessionState {
  user: AuthUser | null;
  role: AppRole | null;
  loading: boolean;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>("/api/auth/me");
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwtToken");
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("jwtToken", token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("jwtToken");
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const token = getToken();
      if (!token) {
        if (mounted) setState({ user: null, role: null, loading: false });
        return;
      }

      try {
        const user = await getCurrentUser();
        if (mounted) {
          setState({ user, role: user?.role ?? null, loading: false });
        }
      } catch {
        if (mounted) setState({ user: null, role: null, loading: false });
      }
    }

    loadSession();
    return () => { mounted = false; };
  }, []);

  return state;
}

export function dashboardPathFor(role: AppRole | null): string {
  if (role === "admin") return "/admin-dashboard";
  if (role === "artisan") return "/artisan-dashboard";
  return "/customer-dashboard";
}
