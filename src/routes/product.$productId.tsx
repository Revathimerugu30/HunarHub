import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Heart, ShoppingBag, Star, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { COLOR_PRESETS, hexFor, filterFor } from "@/lib/colors";

export const Route = createFileRoute("/product/$productId")({
  head: () => ({ meta: [{ title: "Product — HunarHub" }] }),
  component: ProductPage,
});

interface Product {
  id: string; title: string; description: string; price: number; stock: number;
  category: string; images: string[]; artisan_id: string;
  colors: string[]; sizes: string[];
}
interface Profile { id: string; full_name: string; city: string; avatar_url?: string }
interface Review { id: string; rating: number; comment: string; created_at: string; customer_id: string }

function ProductPage() {
  const { productId } = useParams({ from: "/product/$productId" });
  const navigate = useNavigate();
  const [p, setP] = useState<Product | null>(null);
  const [artisan, setArtisan] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selColor, setSelColor] = useState<string>("");
  const [selSize, setSelSize] = useState<string>("");
  const [wished, setWished] = useState(false);
  const [following, setFollowing] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function imageForColor(prod: Product, color: string) {
    if (prod.colors?.length && prod.images?.length === prod.colors.length) {
      const index = prod.colors.indexOf(color);
      if (index >= 0) return prod.images[index];
    }
    return prod.images?.[0];
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const product = await apiFetch<Product>(`/api/products/${encodeURIComponent(productId)}`);
        setP(product);

        if (product.colors?.length) setSelColor(product.colors[0]);
        if (product.sizes?.length) setSelSize(product.sizes[0]);

        const [currentUser, artisanUser, artisanProfile, reviewList] = await Promise.all([
          getCurrentUser().catch(() => null),
          apiFetch<Profile>(`/api/users/${encodeURIComponent(product.artisan_id)}`).catch(() => null),
          apiFetch<{ avatar_url?: string }>(`/api/artisans/${encodeURIComponent(product.artisan_id)}/profile`).catch(() => null),
          apiFetch<Review[]>(`/api/reviews?artisanId=${encodeURIComponent(product.artisan_id)}`).catch(() => []),
        ]);

        setUser(currentUser);
        setUserId(currentUser?._id ?? null);

        const artisanInfo = artisanUser ? { ...artisanUser, avatar_url: artisanProfile?.avatar_url } : null;
        setArtisan(artisanInfo);
        setReviews((reviewList ?? []).map((review) => ({ ...review, id: review.id ?? (review as any)._id })));

        if (currentUser) {
          const [wishlistItems, followItems] = await Promise.all([
            apiFetch<{ product_id: string }[]>(`/api/wishlists?userId=${encodeURIComponent(currentUser._id)}`).catch(() => []),
            apiFetch<{ artisan_id: string }[]>(`/api/follows?followerId=${encodeURIComponent(currentUser._id)}`).catch(() => []),
          ]);
          setWished(wishlistItems.some((item) => item.product_id === product.id));
          setFollowing(followItems.some((item) => item.artisan_id === product.artisan_id));
        }
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to load product");
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  async function toggleWishlist() {
    if (!userId || !p) return toast.error("Please log in");
    try {
      if (wished) {
        await apiFetch(`/api/wishlists?productId=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
        setWished(false);
        toast.success("Removed from wishlist");
      } else {
        await apiFetch('/api/wishlists', {
          method: 'POST',
          body: JSON.stringify({ product_id: p.id }),
        });
        setWished(true);
        toast.success("Saved to wishlist");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Wishlist action failed");
    }
  }

  async function toggleFollow() {
    if (!userId || !p) return toast.error("Please log in");
    try {
      if (following) {
        await apiFetch(`/api/follows?artisanId=${encodeURIComponent(p.artisan_id)}`, { method: 'DELETE' });
        setFollowing(false);
        toast.success("Unfollowed artisan");
      } else {
        await apiFetch('/api/follows', {
          method: 'POST',
          body: JSON.stringify({ artisan_id: p.artisan_id }),
        });
        setFollowing(true);
        toast.success("Following artisan");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Follow action failed");
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!p) return <div className="grid min-h-screen place-items-center text-muted-foreground">Product not found.</div>;

  const selectedImage = imageForColor(p, selColor);
  const hasColorVariantImages = p.colors?.length > 0 && p.images?.length === p.colors.length;
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Link to="/customer-dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <span className="font-display text-lg truncate">{p.title}</span>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 p-4 md:p-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={p.title}
                className="h-full w-full object-cover"
                style={!hasColorVariantImages ? { filter: filterFor(selColor) } : undefined}
              />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground">No image</div>
            )}
          </div>

          {p.colors?.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-6 gap-3 sm:grid-cols-8">
                {p.colors.map((c) => {
                  const colorImage = imageForColor(p, c);
                  return (
                    <button
                      key={c}
                      onClick={() => setSelColor(c)}
                      className={`aspect-square overflow-hidden rounded-lg border-2 bg-muted transition ${selColor === c ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                      title={c}
                    >
                      {colorImage ? (
                        <img 
                          src={colorImage} 
                          alt={c} 
                          className="h-full w-full object-cover"
                          style={!hasColorVariantImages ? { filter: filterFor(c) } : undefined}
                        />
                      ) : (
                        <div className="h-full w-full" style={{ background: hexFor(c) }} />
                      )}
                    </button>
                  );
                })}
              </div>
              {!hasColorVariantImages && (
                <div className="mt-3 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
                  No separate color variant images were uploaded for this product. When the artisan provides a dedicated image for each color, clicking a swatch will show the exact color variant without using any tint filter.
                </div>
              )}
            </>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{p.category}</span>
            <h1 className="mt-3 font-display text-3xl font-semibold">{p.title}</h1>
            <div className="mt-2 flex items-center gap-3">
              <div className="text-3xl font-bold text-primary">₹{p.price}</div>
              {reviews.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {avgRating.toFixed(1)} <Star className="h-3 w-3 fill-white" />
                </span>
              )}
              <span className="text-xs text-muted-foreground">{reviews.length} reviews</span>
            </div>
          </div>

          <p className="text-muted-foreground">{p.description || "No description provided."}</p>

          {p.colors?.length > 0 && (
            <div>
              <div className="text-sm font-medium">Color: <span className="text-muted-foreground">{selColor}</span></div>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelColor(c)}
                    className={`flex items-center gap-2 rounded-full border-2 px-3 py-1 text-xs transition ${selColor === c ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span className="h-4 w-4 rounded-full border border-border" style={{ background: hexFor(c) }} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {p.sizes?.length > 0 && (
            <div>
              <div className="text-sm font-medium">Size</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelSize(s)}
                    className={`min-w-[44px] rounded-md border-2 px-3 py-1.5 text-sm font-medium transition ${selSize === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate({ to: "/checkout/$productId", params: { productId: p.id } })} className="bg-primary hover:bg-primary/90">
              <ShoppingBag className="mr-2 h-4 w-4" /> Buy Now
            </Button>
            <Button variant="outline" onClick={toggleWishlist}>
              <Heart className={`mr-2 h-4 w-4 ${wished ? "fill-primary text-primary" : ""}`} />
              {wished ? "Wishlisted" : "Wishlist"}
            </Button>
            <Button variant="outline" onClick={toggleFollow}>
              {following ? <UserCheck className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {following ? "Following" : "Follow artisan"}
            </Button>
          </div>

          {artisan && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Sold by</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                  {artisan.avatar_url ? <img src={artisan.avatar_url} alt={artisan.full_name || 'Artisan avatar'} className="h-full w-full object-cover" /> : null}
                </div>
                <div>
                  <div className="font-display text-lg">{artisan.full_name || "Artisan"}</div>
                  <div className="text-xs text-muted-foreground">{artisan.city || "Unknown city"}</div>
                </div>
              </div>
            </Card>
          )}

          <div>
            <h2 className="font-display text-xl">Reviews</h2>
            {reviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No reviews yet for this artisan.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {reviews.map((r) => (
                  <Card key={r.id} className="p-3">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-500" />)}
                    </div>
                    <p className="mt-1 text-sm">{r.comment}</p>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
