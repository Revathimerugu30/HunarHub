import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleGate } from "@/components/role-gate";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, CheckCircle2, Circle } from "lucide-react";
import { ORDER_STAGES, stageIndex } from "@/lib/order-stages";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { customerNavItems } from "./customer-dashboard";

export const Route = createFileRoute("/customer-orders")({
  head: () => ({ meta: [{ title: "My orders — HunarHub" }] }),
  component: () => (
    <RoleGate allow="customer">
      <CustomerOrders />
    </RoleGate>
  ),
});

interface Order {
  _id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  order_status: string;
  tracking_status?: string;
  estimated_delivery_date?: string;
  expectedDeliveryTime?: string;
  addressId?: string;
  customerLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  artisanLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  deliveryDistanceKm?: number;
  distanceKm?: number;
  artisanLocationCity?: string;
  customerCity?: string;
  artisan_id?: string;
  created_at: string;
  address: {
    full_name: string;
    mobile?: string;
    house: string;
    area?: string;
    city: string;
    state?: string;
    pincode: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };
}
interface Product { id: string; title: string; images: string[] }

function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const fetchedOrders = await apiFetch<Order[]>(`/api/orders?customerId=${encodeURIComponent(user._id)}`);
      setOrders(fetchedOrders ?? []);

      if (fetchedOrders?.length) {
        const ids = Array.from(new Set(fetchedOrders.map((x) => x.product_id)));
        const productsMap: Record<string, Product> = {};
        await Promise.all(ids.map(async (id) => {
          try {
            const product = await apiFetch<Product>(`/api/products/${encodeURIComponent(id)}`);
            productsMap[id] = product;
          } catch {
            // ignore missing product
          }
        }));
        setProducts(productsMap);
      }
    } catch {
      setOrders([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <DashboardShell title="Customer" navItems={customerNavItems}>
      <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">My orders</h1>
          <p className="text-muted-foreground">Track every order and its delivery progress.</p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl">No orders yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your purchases will appear here.</p>
          </div>
        ) : (
          orders.map((o) => {
            const p = products[o.product_id];
            const status = o.tracking_status || o.order_status;
            const idx = stageIndex(status);
            return (
              <Card key={o._id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex h-20 w-full items-center justify-between gap-4 rounded-2xl bg-muted p-4 lg:w-1/3">
                    <div>
                      <h3 className="font-display text-lg">{p?.title ?? "Product"}</h3>
                      <div className="text-xs text-muted-foreground">Qty {o.quantity} · ₹{o.total_price}</div>
                      <div className="text-xs text-muted-foreground">Ordered {new Date(o.created_at).toLocaleDateString()}</div>
                    </div>
                    {p?.images?.[0] ? <img src={p.images[0]} alt={p.title} className="h-16 w-16 rounded-lg object-cover" /> : null}
                  </div>
                  <div className="grid gap-3 lg:w-2/3">
                    <div className="rounded-2xl border border-border bg-background p-4 text-sm">
                      <div className="font-medium">Delivery address</div>
                      <p>{o.address.full_name}</p>
                      <p>{o.address.house}, {o.address.area ?? ''}</p>
                      <p>{o.address.city}, {o.address.state} {o.address.pincode}</p>
                      {o.address.landmark ? <p className="text-muted-foreground">Near {o.address.landmark}</p> : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-muted p-4 text-sm">
                        <div className="font-medium">Distance</div>
                        <div>{o.deliveryDistanceKm != null ? `${o.deliveryDistanceKm} km away` : 'Location updating...'}</div>
                      </div>
                      <div className="rounded-2xl border border-border bg-muted p-4 text-sm">
                        <div className="font-medium">Artisan location</div>
                        <div>{o.artisanLocationCity ?? 'Location updating...'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <Timeline currentIndex={idx} />
                  <Button
                    size="sm"
                    className="w-full lg:w-auto bg-primary hover:bg-primary/90"
                    onClick={() => navigate({ to: "/order-success", search: { orderId: o._id } })}
                  >
                    Track Order
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}

function Timeline({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="mt-5 space-y-3">
      {ORDER_STAGES.map((s, i) => {
        const done = i <= currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s.key} className="flex items-center gap-3">
            {done ? (
              <CheckCircle2 className={`h-5 w-5 ${active ? "text-primary" : "text-emerald-600"}`} />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/40" />
            )}
            <span className={`text-sm ${done ? "font-medium" : "text-muted-foreground"} ${active ? "text-primary" : ""}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
