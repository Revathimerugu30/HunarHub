import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleGate } from "@/components/role-gate";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Package, ShoppingBag, ShieldCheck, BarChart3, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/admin-dashboard")({
  head: () => ({ meta: [{ title: "Admin dashboard — HunarHub" }] }),
  component: () => (
    <RoleGate allow="admin">
      <AdminDashboard />
    </RoleGate>
  ),
});

interface Profile { id: string; full_name: string; email: string; city: string }
interface Artisan { id: string; user_id: string; verified: boolean }
interface Product { id: string; title: string; price: number; category: string }
interface Order { _id: string; total_price: number; order_status: string; tracking_status?: string; full_name: string; city: string; created_at: string; estimated_delivery_date?: string }

type AdminView = 'overview' | 'users' | 'artisans' | 'products' | 'orders';

const adminNavItems = [
  { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
  { id: 'users' as const, label: 'Users', icon: Users },
  { id: 'artisans' as const, label: 'Artisans', icon: ShieldCheck },
  { id: 'products' as const, label: 'Products', icon: Package },
  { id: 'orders' as const, label: 'Orders', icon: ShoppingBag },
];

function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [artisanCount, setArtisanCount] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeView, setActiveView] = useState<AdminView>('overview');

  async function load() {
    const [users, orders, products, artisanProfiles] = await Promise.all([
      apiFetch<Profile[]>('/api/users?all=true').catch(() => []),
      apiFetch<Order[]>('/api/orders?all=true').catch(() => []),
      apiFetch<Product[]>('/api/products').catch(() => []),
      apiFetch<any[]>('/api/artisans?all=true').catch(() => []),
    ]);

    setProfiles((users ?? []).map((user) => ({
      id: (user as any)._id ?? user.id,
      full_name: user.full_name,
      email: user.email,
      city: user.city ?? '',
    })));
    setOrders(orders ?? []);
    setProducts(products ?? []);
    const profileList = (artisanProfiles ?? []).map((item: any) => ({
      id: item.artisan_id,
      user_id: item.artisan_id,
      verified: item.verified ?? false,
    }));
    setArtisans(profileList);

    // Compute a more accurate artisan count: unique users with role 'artisan' plus any artisan profiles
    try {
      const artisanUsers = (users ?? []).filter((u: any) => (u as any).role === 'artisan').map((u: any) => u._id ?? u.id);
      const profileIds = profileList.map((p) => p.user_id);
      const unique = new Set<string>([...artisanUsers, ...profileIds]);
      setArtisanCount(unique.size);
    } catch {
      setArtisanCount(profileList.length);
    }
  }

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as AdminView;
      if (['overview', 'users', 'artisans', 'products', 'orders'].includes(hash)) {
        setActiveView(hash);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => { load(); }, []);

  async function verifyArtisan(id: string, verified: boolean) {
    try {
      await apiFetch(`/api/artisans/${encodeURIComponent(id)}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ verified }),
      });
      toast.success(verified ? "Artisan verified" : "Verification removed");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update artisan verification');
    }
  }

  async function deleteProduct(id: string) {
    try {
      await apiFetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast.success('Product removed');
      load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to remove product');
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Remove this user's profile?")) return;
    try {
      await apiFetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast.success("User profile removed");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to remove user');
    }
  }

  const revenue = orders.reduce((s, o) => s + Number(o.total_price), 0);
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    const status = o.tracking_status || o.order_status;
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  const dashboardNavItems = adminNavItems.map((item) => ({
    label: item.label,
    icon: item.icon,
    onClick: () => {
      window.location.hash = item.id;
      setActiveView(item.id);
    },
    active: activeView === item.id,
  }));

  return (
    <DashboardShell title="Admin" navItems={dashboardNavItems}>
      <div className="mx-auto max-w-7xl p-6 md:p-10">
        {activeView === 'overview' && (
          <div className="space-y-8">
            <div>
              <h1 className="font-display text-3xl font-semibold">Admin control room</h1>
              <p className="text-muted-foreground">Monitor users, artisans, products and orders.</p>
            </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Users" value={profiles.length} icon={Users} />
          <Stat label="Artisans" value={artisanCount ?? artisans.length} icon={ShieldCheck} />
          <Stat label="Products" value={products.length} icon={Package} />
          <Stat label="Revenue" value={`₹${revenue.toFixed(0)}`} icon={ShoppingBag} />
        </div>

        <Card className="p-6">
          <h2 className="font-display text-xl">Order pipeline</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {["placed", "accepted", "preparing", "shipped", "out_for_delivery", "delivered"].map((s) => (
              <div key={s} className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.replace(/_/g, " ")}</div>
                <div className="mt-1 font-display text-2xl text-primary">{statusCounts[s] ?? 0}</div>
              </div>
            ))}
          </div>
        </Card>
          </div>
        )}

        {activeView === 'artisans' && (
          <Card className="p-6" id="artisans">
          <h2 className="font-display text-xl">Artisan verification</h2>
          {artisans.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No artisans yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {artisans.map((a) => {
                const p = profiles.find((x) => x.id === a.user_id);
                return (
                  <div key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{p?.full_name || "(no name)"} <span className="ml-2 text-xs text-muted-foreground capitalize">{a.category}</span></div>
                      <div className="text-xs text-muted-foreground">{p?.email} · {p?.city}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </span>
                      ) : null}
                      <Button size="sm" variant={a.verified ? "outline" : "default"} onClick={() => verifyArtisan(a.id, !a.verified)} className={!a.verified ? "bg-primary hover:bg-primary/90" : ""}>
                        {a.verified ? "Revoke" : "Verify"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        )}

        {activeView === 'orders' && (
          <Card className="p-6" id="orders">
          <h2 className="font-display text-xl">All orders</h2>
          {orders.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {orders.map((o) => (
                <div key={o._id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{o.full_name || "Customer"} · {o.city}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                    {o.estimated_delivery_date ? (
                      <div className="text-xs text-muted-foreground">ETA: {new Date(o.estimated_delivery_date).toLocaleDateString()}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{(o.tracking_status || o.order_status).replace(/_/g, " ")}</span>
                    <span className="font-semibold text-primary">₹{o.total_price}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        )}

        {activeView === 'products' && (
          <Card className="p-6" id="products">
          <h2 className="font-display text-xl">All products</h2>
          {products.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No products yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground capitalize">{p.category}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-primary">₹{p.price}</span>
                    <Button size="sm" variant="ghost" onClick={() => deleteProduct(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        )}

        {activeView === 'users' && (
          <Card className="p-6" id="users">
          <h2 className="font-display text-xl">All users</h2>
          <div className="mt-4 divide-y divide-border">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{p.full_name || "(no name)"}</div>
                  <div className="text-xs text-muted-foreground">{p.email} · {p.city}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteUser(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
        )}
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 font-display text-3xl font-semibold text-primary">{value}</div>
    </Card>
  );
}
