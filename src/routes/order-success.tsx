import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleGate } from "@/components/role-gate";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/order-success")({
  head: () => ({ meta: [{ title: "Order success — HunarHub" }] }),
  component: () => (
    <RoleGate allow="customer">
      <OrderSuccess />
    </RoleGate>
  ),
});

function OrderSuccess() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const queryOrderId = search.orderId as string | undefined;
    const savedOrderId = typeof window !== 'undefined' ? localStorage.getItem('lastOrderId') : null;
    const resolvedOrderId = queryOrderId || savedOrderId;

    if (resolvedOrderId) {
      setOrderId(resolvedOrderId);
      (async () => {
        try {
          const fetched = await apiFetch(`/api/orders/${encodeURIComponent(resolvedOrderId)}`);
          setOrder(fetched);
        } catch {
          setOrder(null);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, [search.orderId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      navigate({ to: "/customer-orders" });
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="font-display text-3xl font-semibold">Order confirmed</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your order is placed successfully. We are notifying the artisan and will update tracking shortly.
          </p>
          {orderId ? (
            <div className="mt-4 rounded-2xl border border-border bg-muted p-4 text-left text-sm">
              <div className="font-medium">Order ID</div>
              <div className="break-all text-xs text-muted-foreground">{orderId}</div>
              {order?.tracking_status ? (
                <div className="mt-3 text-sm">Current status: <span className="font-medium">{order.tracking_status.replace(/_/g, ' ')}</span></div>
              ) : null}
            </div>
          ) : null}
          <Button className="mt-8" onClick={() => navigate({ to: "/customer-orders" })}>
            Go to My Orders
          </Button>
        </Card>
      </div>
    </div>
  );
}
