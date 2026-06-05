import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { RoleGate } from "@/components/role-gate";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { customerNavItems } from "./customer-dashboard";

export const Route = createFileRoute("/customer-wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — HunarHub" }] }),
  component: () => (
    <RoleGate allow="customer">
      <CustomerWishlist />
    </RoleGate>
  ),
});

interface Product { id: string; title: string; price: number; images: string[]; description: string }

function CustomerWishlist() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const wishlistRows = await apiFetch<{ product_id: string }[]>(`/api/wishlists?userId=${encodeURIComponent(user._id)}`);
      const ids = (wishlistRows ?? []).map((x) => x.product_id);
      if (!ids.length) { setItems([]); return; }
      const products = await Promise.all(ids.map((id) => apiFetch<Product>(`/api/products/${encodeURIComponent(id)}`)));
      setItems(products.filter(Boolean) as Product[]);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load wishlist:', err?.message ?? err);
      toast.error('Failed to load wishlist');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    const user = await getCurrentUser();
    if (!user) return;
    await apiFetch(`/api/wishlists?productId=${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast.success("Removed");
    load();
  }

  return (
    <DashboardShell title="Customer" navItems={customerNavItems}>
      <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">Your wishlist</h1>
          <p className="text-muted-foreground">Saved products you love.</p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl">Nothing saved yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any product to save it here.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Card key={p.id} className="overflow-hidden p-0">
                <div className="aspect-[4/3] bg-muted">
                  {p.images?.[0] ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-display">{p.title}</h3>
                    <span className="text-primary font-semibold">₹{p.price}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => remove(p.id)}><Trash2 className="mr-1 h-4 w-4" />Remove</Button>
                    <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90" onClick={() => navigate({ to: "/checkout/$productId", params: { productId: p.id } })}>Buy now</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
