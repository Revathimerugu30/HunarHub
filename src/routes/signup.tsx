import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Hammer, ShieldAlert } from "lucide-react";
import { dashboardPathFor, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>) => ({
    role: (s.role === "artisan" ? "artisan" : "customer") as "artisan" | "customer",
  }),
  head: () => ({ meta: [{ title: "Create your HunarHub account" }] }),
  component: SignupPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Name required").max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
  city: z.string().trim().min(2, "City required").max(80),
  role: z.enum(["customer", "artisan"]),
});

type Role = "customer" | "artisan" | "admin";

function SignupPage() {
  const { role: initialRole } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<Role>(initialRole);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", city: "" });
  const ADMIN_EMAIL = "admin123@gmail.com";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (role === "admin") {
      if (!form.email || !form.password) {
        toast.error("Enter admin email and password.");
        return;
      }

      setLoading(true);
      try {
        // Admin login - use the /api/auth/login endpoint
        const result = await apiFetch<{ token: string; user: { id: string; role: string } }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: form.email,
            password: form.password,
          }),
        });

        // Store JWT token in localStorage
        localStorage.setItem('jwtToken', result.token);
        setLoading(false);
        toast.success("Welcome back!");
        navigate({ to: "/admin-dashboard" });
      } catch (error) {
        setLoading(false);
        if ((error as Error).message.includes('401') || (error as Error).message.includes('404')) {
          toast.error("Invalid admin credentials.");
        } else {
          toast.error((error as Error).message || "Admin login failed");
        }
      }
      return;
    }

    const parsed = schema.safeParse({ ...form, role });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    
    setLoading(true);
    try {
      // Call the /api/auth/signup endpoint
      const result = await apiFetch<{ token: string; user: { id: string; email: string; role: string } }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
          full_name: parsed.data.full_name,
          city: parsed.data.city,
          role: parsed.data.role,
        }),
      });

      // Store JWT token in localStorage
      localStorage.setItem('jwtToken', result.token);
      setLoading(false);
      
      toast.success("Welcome to HunarHub!");
      const finalRole: AppRole = parsed.data.email === ADMIN_EMAIL ? "admin" : parsed.data.role;
      navigate({ to: dashboardPathFor(finalRole) });
    } catch (error) {
      setLoading(false);
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('already exists') || errorMsg.includes('400')) {
        toast.error("Email already registered.");
      } else {
        toast.error(errorMsg || "Signup failed");
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
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            "Every pair of hands has a story. Tell yours."
          </h2>
          <p className="mt-4 text-primary-foreground/80">— HunarHub manifesto</p>
        </div>
        <div className="text-xs text-primary-foreground/60">Crafted in India</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Already have one? <Link to="/login" className="text-primary underline-offset-4 hover:underline">Login</Link>
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label>Create account as</Label>
              <RadioGroup
                value={role}
                onValueChange={(v) => setRole(v as Role)}
                className="mt-2 grid grid-cols-3 gap-2"
              >
                {(["customer", "artisan", "admin"] as const).map((r) => (
                  <label key={r} className={`cursor-pointer rounded-lg border-2 p-3 text-center text-sm font-medium capitalize transition ${role === r ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
                    <RadioGroupItem value={r} className="sr-only" />
                    {r}
                  </label>
                ))}
              </RadioGroup>
            </div>

            {role === "admin" ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      Admin login
                    </p>
                    <p className="mt-1 text-amber-800 dark:text-amber-300">
                      Enter your admin credentials below.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="email">Admin Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Admin Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="mt-4 w-full bg-primary hover:bg-primary/90">
                  {loading ? "Signing in..." : "Log in as admin"}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Local admin credentials: <span className="font-medium">admin123@gmail.com</span> / <span className="font-medium">Admin@123</span>
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
                  {loading ? "Creating..." : "Create account"}
                </Button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
