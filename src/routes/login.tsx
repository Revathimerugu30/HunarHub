import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Hammer } from "lucide-react";
import { dashboardPathFor, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — HunarHub" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await apiFetch<{ token: string; user: { id: string; role: string } }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      // Store JWT token in localStorage
      localStorage.setItem('jwtToken', result.token);
      setLoading(false);
      
      // Determine user role and navigate to appropriate dashboard
      const role: AppRole = (result.user.role as AppRole) ?? "customer";
      toast.success("Welcome back!");
      navigate({ to: dashboardPathFor(role) });
    } catch (error) {
      setLoading(false);
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('401') || errorMsg.includes('404') || errorMsg.includes('Invalid')) {
        toast.error("Invalid email or password");
      } else {
        toast.error(errorMsg || "Login failed");
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-warm grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-gradient-sienna p-12 text-primary-foreground">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-background/15">
            <Hammer className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold">HunarHub</span>
        </Link>
        <h2 className="font-display text-4xl font-semibold leading-tight">
          Welcome back to the workshop.
        </h2>
        <div className="text-xs text-primary-foreground/60">Crafted in India</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-semibold">Log in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            New here? <Link to="/signup" search={{ role: "customer" }} className="text-primary underline-offset-4 hover:underline">Create an account</Link>
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
              {loading ? "Signing in..." : "Log in"}
            </Button>
          </form>

          <div className="mt-8 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Admin access</p>
            <p className="mt-1">
              Admin users should sign in with their credentials.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Local admin credentials: <span className="font-medium">admin123@gmail.com</span> / <span className="font-medium">Admin@123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
