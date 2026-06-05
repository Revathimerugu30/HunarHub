import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleGate } from "@/components/role-gate";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/checkout/$productId")({
  head: () => ({ meta: [{ title: "Checkout — HunarHub" }] }),
  component: () => (
    <RoleGate allow="customer">
      <CheckoutPage />
    </RoleGate>
  ),
});

const DELIVERY = 49;

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  artisanLocationAvailable?: boolean;
}

interface Address {
  _id: string;
  full_name: string;
  mobile: string;
  house: string;
  street?: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
}

function CheckoutPage() {
  const { productId } = useParams({ from: "/checkout/$productId" });
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [addr, setAddr] = useState<Address>({
    _id: '',
    full_name: '',
    mobile: '',
    house: '',
    street: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    latitude: undefined,
    longitude: undefined,
  });

  useEffect(() => {
    loadCheckout();
  }, [productId]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('Geolocation not available in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus('Location captured for delivery preferences');
      },
      () => {
        setLocationStatus('Allow location for faster delivery updates');
      },
      { timeout: 10000 },
    );
  }, []);

  async function loadCheckout() {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [productResponse, addressResponse] = await Promise.all([
        apiFetch<Product>(`/api/products/${encodeURIComponent(productId)}`),
        apiFetch<Address[]>(`/api/addresses`),
      ]);
      setProduct(productResponse);
      setAddresses(addressResponse ?? []);
      if (addressResponse?.length) {
        const defaultAddress = addressResponse.find((item) => item._id === selectedAddressId) ?? addressResponse[0];
        setSelectedAddressId(defaultAddress._id);
        setAddr({
          _id: defaultAddress._id,
          full_name: defaultAddress.full_name,
          mobile: defaultAddress.mobile,
          house: defaultAddress.house,
          street: defaultAddress.street ?? defaultAddress.area ?? "",
          city: defaultAddress.city,
          state: defaultAddress.state,
          pincode: defaultAddress.pincode,
          landmark: defaultAddress.landmark,
          latitude: defaultAddress.latitude,
          longitude: defaultAddress.longitude,
        });
      }
    } catch (err) {
      toast.error((err as Error)?.message || "Unable to load checkout data");
    }

    setLoading(false);
  }

  function selectAddress(address: Address) {
    setSelectedAddressId(address._id);
    setAddr({
      ...address,
      street: address.street ?? address.area ?? "",
      latitude: address.latitude,
      longitude: address.longitude,
    });
  }

  async function saveAddress() {
    try {
      const saved = await apiFetch<Address>("/api/addresses", {
        method: "POST",
        body: JSON.stringify({
          full_name: addr.full_name,
          mobile: addr.mobile,
          house: addr.house,
          street: addr.street,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          landmark: addr.landmark,
          latitude: addr.latitude,
          longitude: addr.longitude,
          is_default: true,
        }),
      });

      const normalized = {
        ...saved,
        street: saved.street ?? saved.area ?? "",
      };
      setAddresses((prev) => [normalized, ...prev.filter((address) => address._id !== saved._id)]);
      setSelectedAddressId(normalized._id);
      setAddr(normalized);
      toast.success("Address saved to your account");
    } catch (err) {
      toast.error((err as Error)?.message || "Unable to save address");
    }
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    if (!addr.full_name || !addr.mobile || !addr.house || !addr.street || !addr.city || !addr.pincode) {
      return toast.error("Please fill all required address fields");
    }

    setPlacing(true);
    try {
      const total = Number(product.price) * qty + DELIVERY;
      const customerLatitude = geoLocation?.latitude ?? addr.latitude;
      const customerLongitude = geoLocation?.longitude ?? addr.longitude;
      const savedOrder = await apiFetch<{ _id: string }>(`/api/orders`, {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          quantity: qty,
          product_price: product.price,
          total_price: total,
          payment_status: "cod",
          order_status: "placed",
          tracking_status: "placed",
          addressId: selectedAddressId,
          full_name: addr.full_name,
          mobile: addr.mobile,
          house: addr.house,
          street: addr.street,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          landmark: addr.landmark,
          customerLatitude,
          customerLongitude,
          latitude: customerLatitude,
          longitude: customerLongitude,
          is_default: true,
        }),
      });
      if (savedOrder?._id) {
        localStorage.setItem('lastOrderId', savedOrder._id);
      }
      toast.success("Order placed successfully");
      navigate({ to: "/order-success" });
    } catch (err) {
      toast.error((err as Error)?.message || "Unable to place order");
    } finally {
      setPlacing(false);
    }
  }

  if (loading || !product) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  const subtotal = Number(product.price) * qty;
  const total = subtotal + DELIVERY;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Link to="/customer-dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <span className="font-display text-lg">Checkout</span>
      </header>

      {locationStatus ? (
        <Card className="mx-auto mt-4 max-w-5xl rounded-2xl border border-border bg-muted p-4 text-sm text-muted-foreground">
          {locationStatus}
        </Card>
      ) : null}

      {product?.artisanLocationAvailable === false ? (
        <Card className="mx-auto mt-4 max-w-5xl rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          This artisan has not shared workshop location yet. Your order can still be placed, but delivery tracking updates may begin later once the artisan adds location details.
        </Card>
      ) : null}

      <form onSubmit={placeOrder} className="mx-auto grid max-w-5xl gap-6 p-4 md:p-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="flex gap-4 p-4">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="font-display text-lg">{product.title}</h2>
                <div className="mt-1 text-primary font-semibold">₹{product.price}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Label htmlFor="qty" className="text-xs text-muted-foreground">Qty</Label>
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-7 w-7 rounded border border-border">-</button>
                  <span id="qty" className="w-8 text-center">{qty}</span>
                  <button type="button" onClick={() => setQty((q) => q + 1)} className="h-7 w-7 rounded border border-border">+</button>
                </div>
              </div>
            </div>
          </Card>

          {addresses.length > 0 ? (
            <Card className="p-6">
              <h3 className="font-display text-lg">Saved addresses</h3>
              <div className="mt-4 space-y-3">
                {addresses.map((address) => (
                  <button
                    key={address._id}
                    type="button"
                    onClick={() => selectAddress(address)}
                    className={`w-full rounded-xl border p-4 text-left transition ${selectedAddressId === address._id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/70'}`}
                  >
                    <div className="font-medium">{address.full_name} · {address.mobile}</div>
                    <div className="text-sm text-muted-foreground">
                      {address.house}, {address.street ?? address.area}, {address.city}, {address.state} {address.pincode}
                      {address.landmark ? ` · Near ${address.landmark}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="p-6">
            <h3 className="font-display text-lg">Delivery address</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field required label="Full Name *" value={addr.full_name} onChange={(v) => setAddr({ ...addr, full_name: v })} />
              <Field required label="Mobile Number *" value={addr.mobile} onChange={(v) => setAddr({ ...addr, mobile: v })} />
              <Field required label="House Number *" value={addr.house} onChange={(v) => setAddr({ ...addr, house: v })} />
              <Field required label="Street *" value={addr.street} onChange={(v) => setAddr({ ...addr, street: v })} />
              <Field required label="City *" value={addr.city} onChange={(v) => setAddr({ ...addr, city: v })} />
              <Field required label="State *" value={addr.state} onChange={(v) => setAddr({ ...addr, state: v })} />
              <Field required label="Pincode *" value={addr.pincode} onChange={(v) => setAddr({ ...addr, pincode: v })} />
              <Field label="Landmark" value={addr.landmark ?? ''} onChange={(v) => setAddr({ ...addr, landmark: v })} />
            </div>
            <Button type="button" variant="outline" className="mt-4" onClick={saveAddress}>Save address</Button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-lg">Order summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label={`Item (×${qty})`} value={`₹${subtotal}`} />
              <Row label="Delivery" value={`₹${DELIVERY}`} />
              <div className="border-t border-border pt-2 font-semibold">
                <Row label="Total" value={`₹${total}`} />
              </div>
            </dl>
            <Button type="submit" disabled={placing} className="mt-5 w-full bg-primary hover:bg-primary/90">
              <ShoppingBag className="mr-2 h-4 w-4" />
              {placing ? "Placing order…" : "Place Order"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">Cash on Delivery — pay when your order arrives.</p>
          </Card>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input required={required} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
