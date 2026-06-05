import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleGate } from "@/components/role-gate";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { ORDER_STAGES, nextStage, stageIndex } from "@/lib/order-stages";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { artisanNavItems } from "./artisan-dashboard";

export const Route = createFileRoute("/artisan-orders")({
  head: () => ({ meta: [{ title: "Manage orders — HunarHub" }] }),
  component: () => (
    <RoleGate allow="artisan">
      <ArtisanOrders />
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
  distanceKm?: number;
  customer_id: string;
  address: {
    full_name: string;
    mobile: string;
    house: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
}
interface Product { id: string; title: string; images: string[] }

function ArtisanOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [etaByOrder, setEtaByOrder] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const fetchedProducts = await apiFetch<Product[]>(`/api/products?artisanId=${encodeURIComponent(user._id)}`);
      const productMap: Record<string, Product> = {};
      fetchedProducts?.forEach((product) => {
        productMap[product.id] = product;
      });
      setProducts(productMap);

      const fetchedOrders = await apiFetch<Order[]>(`/api/orders?artisanId=${encodeURIComponent(user._id)}`);
      setOrders(fetchedOrders ?? []);
      const nextEta: Record<string, string> = {};
      (fetchedOrders ?? []).forEach((order) => {
        if (order.estimated_delivery_date) {
          nextEta[order._id] = new Date(order.estimated_delivery_date).toISOString().slice(0, 10);
        }
      });
      setEtaByOrder(nextEta);
    } catch {
      setOrders([]);
      setProducts({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    try {
      await apiFetch(`/api/orders/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
          order_status: status,
          tracking_status: status,
          estimated_delivery_date: etaByOrder[id],
        }),
      });
      toast.success(`Marked ${status.replace(/_/g, " ")}`);
      load();
    } catch (err) {
      toast.error((err as Error)?.message || "Unable to update status");
    }
  }

  async function updateEta(orderId: string) {
    try {
      await apiFetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: "PUT",
        body: JSON.stringify({
          estimated_delivery_date: etaByOrder[orderId],
        }),
      });
      toast.success("Estimated delivery date updated");
      load();
    } catch (err) {
      toast.error((err as Error)?.message || "Unable to update estimated delivery date");
    }
  }

  return (
    <DashboardShell title="Artisan" navItems={artisanNavItems}>
      <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">Manage orders</h1>
          <p className="text-muted-foreground">Accept orders and update delivery status.</p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl">No orders yet</h3>
          </div>
        ) : (
          orders.map((o) => {
            const p = products[o.product_id];
            const status = o.tracking_status || o.order_status;
            const idx = stageIndex(status);
            const next = nextStage(status);
            return (
              <Card key={o._id} className="p-5">
                <div className="flex flex-wrap gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {p?.images?.[0] ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="flex-1 min-w-[240px]">
                    <h3 className="font-display text-lg">{p?.title ?? "Product"}</h3>
                    <div className="text-xs text-muted-foreground">Qty {o.quantity} · ₹{o.total_price} · {new Date(o.created_at).toLocaleString()}</div>
                    <div className="mt-2 text-sm">
                      <strong>{o.address.full_name}</strong> · {o.address.mobile}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[o.address.house, o.address.area, o.address.city, o.address.state, o.address.pincode].filter(Boolean).join(", ")}
                      {o.address.landmark && ` (near ${o.address.landmark})`}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl bg-muted px-3 py-2 text-sm">
                        <div className="font-medium">Distance</div>
                        <div>{o.distanceKm != null ? `${o.distanceKm} km` : 'Unknown'}</div>
                      </div>
                      <div className="rounded-xl bg-muted px-3 py-2 text-sm">
                        <div className="font-medium">Current status</div>
                        <div>{(o.tracking_status || o.order_status).replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                    {o.estimated_delivery_date ? (
                      <div className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                        Estimated delivery: {new Date(o.estimated_delivery_date).toLocaleDateString()}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {ORDER_STAGES[idx].label}
                    </span>
                    <div className="flex flex-col gap-2">
                      {next && (
                        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setStatus(o._id, next)}>
                          Mark {ORDER_STAGES[stageIndex(next)].label}
                        </Button>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={etaByOrder[o._id] ?? ''}
                          onChange={(event) => setEtaByOrder((prev) => ({ ...prev, [o._id]: event.target.value }))}
                          className="rounded border border-border bg-background px-3 py-2 text-sm"
                        />
                        <Button size="sm" variant="outline" onClick={() => updateEta(o._id)}>
                          Update ETA
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}
