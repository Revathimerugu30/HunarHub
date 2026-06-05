import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { RoleGate } from "@/components/role-gate";
import { DashboardShell } from "@/components/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LayoutGrid, Heart, ShoppingBag, Star, Search, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/customer-dashboard")({
  head: () => ({ meta: [{ title: "Browse — HunarHub" }] }),
  component: () => (
    <RoleGate allow="customer">
      <CustomerDashboard />
    </RoleGate>
  ),
});

const CATEGORIES = ["all", "tailor", "potter", "cobbler", "weaver", "artisan", "vendor"];

interface Product {
  id: string; title: string; description: string; price: number;
  images: string[]; stock: number; category: string; artisan_id: string;
}

interface ArtisanMeta {
  full_name: string;
  city: string;
  rating: number;
}

export const customerNavItems = [
  { to: "/customer-dashboard", label: "Browse", icon: LayoutGrid },
  { to: "/customer-orders", label: "My orders", icon: Package },
  { to: "/customer-wishlist", label: "Wishlist", icon: Heart },
  { to: "#reviews", label: "Reviews", icon: Star },
];

function CustomerDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [artisanMeta, setArtisanMeta] = useState<Record<string, ArtisanMeta>>({});
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [artisanDistances, setArtisanDistances] = useState<Record<string, number>>({});
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const navigate = useNavigate();

  const loadWishlist = useCallback(async (uid: string) => {
    const wishlistItems = await apiFetch<{ product_id: string }[]>(`/api/wishlists?userId=${encodeURIComponent(uid)}`);
    setWishlist(new Set((wishlistItems ?? []).map((w) => w.product_id)));
  }, []);

  async function loadNearbyArtisans(lat: number, lng: number) {
    try {
      const nearby = await apiFetch<any[]>(`/api/artisans?nearby=true&lat=${lat}&lng=${lng}&radius=50`);
      const distanceMap: Record<string, number> = {};
      (nearby ?? []).forEach((artisan) => {
        if (!artisan?.artisan_id) return;
        distanceMap[artisan.artisan_id] = artisan.distanceKm ?? distanceMap[artisan.artisan_id] ?? Infinity;
      });
      setArtisanDistances(distanceMap);
      setLocationEnabled(true);
      setLocationStatus(`${Object.keys(distanceMap).length} nearby artisans found`);
    } catch (err: any) {
      setLocationStatus('Unable to load nearby artisans');
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<Product[]>('/api/products');
        const incomingProducts = data ?? [];
        const artisanIds = Array.from(new Set(incomingProducts.map((product) => product.artisan_id).filter(Boolean)));

        const [reviews, artisanUsers] = await Promise.all([
          apiFetch<any[]>('/api/reviews').catch(() => []),
          Promise.all(
            artisanIds.map(async (artisanId) => {
              try {
                return await apiFetch<{ _id: string; full_name: string; city?: string }>(`/api/users/${encodeURIComponent(artisanId)}`);
              } catch {
                return null;
              }
            }),
          ),
        ]);

        const ratingMap = (reviews ?? []).reduce<Record<string, { total: number; count: number }>>((acc, review) => {
          if (!review?.artisan_id) return acc;
          const existing = acc[review.artisan_id] ?? { total: 0, count: 0 };
          existing.total += Number(review.rating ?? 0);
          existing.count += 1;
          acc[review.artisan_id] = existing;
          return acc;
        }, {});

        const artisanMetaMap: Record<string, ArtisanMeta> = {};
        (artisanUsers ?? []).forEach((artisan) => {
          if (!artisan) return;
          const summary = ratingMap[artisan._id] ?? { total: 0, count: 0 };
          artisanMetaMap[artisan._id] = {
            full_name: artisan.full_name || 'Artisan',
            city: artisan.city || 'India',
            rating: summary.count ? summary.total / summary.count : 0,
          };
        });

        setProducts(incomingProducts);
        setArtisanMeta(artisanMetaMap);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn('Failed to load products:', err?.message ?? err);
        toast.error('Failed to load products');
        setProducts([]);
        setArtisanMeta({});
      } finally {
        setLoading(false);
      }
      const user = await getCurrentUser();
      if (user) {
        setUserId(user._id);
        loadWishlist(user._id).catch(() => {});
        try {
          const all = await apiFetch<any[]>('/api/reviews');
          setMyReviews((all ?? []).filter((r) => r.customer_id === user._id));
        } catch (err) {
          // ignore review load errors
        }
      }

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
            setLocationCoords(coords);
            loadNearbyArtisans(coords.lat, coords.lng);
          },
          () => {
            setLocationStatus('Location access denied');
          },
          { timeout: 10000 },
        );
      } else {
        setLocationStatus('Geolocation not available in this browser');
      }
    })();
  }, [loadWishlist]);

  useEffect(() => {
    if (Object.keys(artisanDistances).length === 0 || products.length === 0) return;
    setProducts((prevProducts) => [...prevProducts].sort((a, b) => {
      const da = artisanDistances[a.artisan_id] ?? Infinity;
      const db = artisanDistances[b.artisan_id] ?? Infinity;
      return da - db;
    }));
  }, [artisanDistances]);

  async function toggleWishlist(p: Product) {
    if (!userId) {
      toast.error('Please log in to save items.');
      return;
    }
    if (wishlist.has(p.id)) {
      try {
        await apiFetch(`/api/wishlists?productId=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
        setWishlist((w) => { const n = new Set(w); n.delete(p.id); return n; });
        toast.success('Removed from wishlist');
      } catch (err: any) {
        console.warn('Failed to remove wishlist item:', err?.message ?? err);
        toast.error('Could not remove from wishlist');
      }
    } else {
      try {
        await apiFetch('/api/wishlists', {
          method: 'POST',
          body: JSON.stringify({ product_id: p.id }),
        });
        setWishlist((w) => new Set(w).add(p.id));
        toast.success('Added to wishlist');
      } catch (err: any) {
        console.warn('Failed to add wishlist item:', err?.message ?? err);
        toast.error('Could not add to wishlist');
      }
    }
  }

  const filtered = products.filter((p) => {
    const matchCat = category === "all" || p.category === category;
    const matchQ = !query || p.title.toLowerCase().includes(query.toLowerCase()) || (p.description || "").toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <DashboardShell title="Customer" navItems={customerNavItems}>
      <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">Discover craft</h1>
          <p className="text-muted-foreground">Browse handmade products from artisans across India.</p>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search products, skills, cities..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"}`}>{c}</button>
              ))}
            </div>
          </div>
        </Card>

        {locationStatus ? (
          <Card className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
            <div className="flex flex-col gap-4">
              <div>
                <div className="font-medium text-foreground">Location discovery</div>
                <div>{locationStatus}</div>
                {locationEnabled ? <div>Products are sorted by nearby artisans first.</div> : null}
              </div>
              {locationCoords ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-black/5">
                  <iframe
                    title="Your location map"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationCoords.lng - 0.03}%2C${locationCoords.lat - 0.03}%2C${locationCoords.lng + 0.03}%2C${locationCoords.lat + 0.03}&layer=mapnik&marker=${locationCoords.lat}%2C${locationCoords.lng}`}
                    className="h-56 w-full"
                    loading="lazy"
                  />
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">Loading products…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl">No products yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Once artisans add products, they'll appear here.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Card
                key={p.id}
                onClick={() => navigate({ to: "/product/$productId", params: { productId: p.id } })}
                className="cursor-pointer overflow-hidden p-0 transition hover:-translate-y-1 hover:shadow-warm"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">No image</div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWishlist(p); }}
                    aria-label="Toggle wishlist"
                    className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/90 shadow-sm backdrop-blur transition hover:scale-110"
                  >
                    <Heart className={`h-4 w-4 ${wishlist.has(p.id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg">{p.title}</h3>
                    <span className="text-primary font-semibold">₹{p.price}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{p.category}</span>
                      <span className="text-xs text-muted-foreground">
                        {artisanMeta[p.artisan_id]?.full_name || 'Artisan'} · {artisanMeta[p.artisan_id]?.city || 'India'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Star className="h-3 w-3" /> {artisanMeta[p.artisan_id]?.rating?.toFixed(1) ?? 'New'}
                      </span>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate({ to: "/checkout/$productId", params: { productId: p.id } }); }}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Buy now
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        <section id="reviews" className="mx-auto max-w-6xl space-y-4 p-6 md:p-10">
          <h2 className="font-display text-2xl font-semibold">My reviews</h2>
          <p className="text-sm text-muted-foreground">Reviews you've left for artisans.</p>
          <div className="mt-4">
            {userId === null ? (
              <div className="text-sm text-muted-foreground">Log in to view and add reviews.</div>
            ) : myReviews.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
                <Star className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-4 font-display text-lg">No reviews yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Visit a product page to leave a review.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {myReviews.map((r) => (
                  <Card key={r._id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">Rating: {r.rating} / 5</div>
                        {r.comment && <div className="text-sm text-muted-foreground mt-1">{r.comment}</div>}
                        <div className="mt-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
