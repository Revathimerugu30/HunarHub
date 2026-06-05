import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { RoleGate } from "@/components/role-gate";
import { DashboardShell } from "@/components/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Store, Package, ClipboardList, BarChart3, Plus, Upload, Trash2, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { COLOR_PRESETS, SIZE_PRESETS, hexFor } from "@/lib/colors";

export const Route = createFileRoute("/artisan-dashboard")({
  head: () => ({ meta: [{ title: "Artisan dashboard — HunarHub" }] }),
  component: () => (
    <RoleGate allow="artisan">
      <ArtisanDashboard />
    </RoleGate>
  ),
});

interface Product { id: string; title: string; price: number; stock: number; category: string; description?: string; images: string[]; colors?: string[]; sizes?: string[] }
interface ArtisanProfile { available: boolean; bio: string; skills: string[]; experience_years: number; avatar_url?: string; workshop_latitude?: number; workshop_longitude?: number; workshop_address?: string }

const CATS = ["tailor", "potter", "cobbler", "weaver", "artisan", "vendor"];
const SIGNED_TTL = 60 * 60 * 24 * 365 * 5; // 5 years

export const artisanNavItems = [
  { to: "/artisan-dashboard", label: "Workshop", icon: BarChart3 },
  { to: "/artisan-orders", label: "Orders", icon: ClipboardList },
  { to: "/artisan-dashboard", label: "Products", icon: Package },
  { to: "/artisan-dashboard", label: "Profile", icon: Store },
];

function ArtisanDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<ArtisanProfile>({ available: true, bio: "", skills: [], experience_years: 0, workshop_latitude: undefined, workshop_longitude: undefined, workshop_address: "" });
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [form, setForm] = useState({ title: "", description: "", price: "", stock: "1", category: "artisan" });
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [colorImages, setColorImages] = useState<Record<string, string>>({});
  const [variantPreviewUrls, setVariantPreviewUrls] = useState<Record<string, string>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const variantUploadColorRef = useRef<string | null>(null);
  const [variantUploadColor, setVariantUploadColor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const variantFileRef = useRef<HTMLInputElement>(null);
  const [skillInput, setSkillInput] = useState("");
  const [activeSection, setActiveSection] = useState<'workshop' | 'products' | 'profile'>('workshop');

  const dashboardNavItems = [
    { label: "Workshop", icon: BarChart3, onClick: () => setActiveSection('workshop'), active: activeSection === 'workshop' },
    { label: "Products", icon: Package, onClick: () => setActiveSection('products'), active: activeSection === 'products' },
    { label: "Profile", icon: Store, onClick: () => setActiveSection('profile'), active: activeSection === 'profile' },
    { label: "Orders", icon: ClipboardList, to: "/artisan-orders" },
  ];

  const sectionHeader = {
    workshop: { title: "Your workshop", description: "Manage products, orders, and availability." },
    products: { title: "Your products", description: "Review and manage listed products." },
    profile: { title: "Profile", description: "Update your artisan story, skills, and avatar." },
  }[activeSection];

  async function load(id: string) {
    try {
      const [products, artisan, orders] = await Promise.all([
        apiFetch<Product[]>(`/api/products?artisanId=${encodeURIComponent(id)}`).catch(() => []),
        apiFetch<ArtisanProfile>(`/api/artisans/${encodeURIComponent(id)}/profile`).catch(() => ({ available: true, bio: "", skills: [], experience_years: 0, workshop_latitude: undefined, workshop_longitude: undefined, workshop_address: "" })),
        apiFetch<any[]>(`/api/orders?artisanId=${encodeURIComponent(id)}`).catch(() => []),
      ]);
      const validProducts = products.filter((product) => !product.id?.startsWith('sample-'));
      setProducts(validProducts);
      setProfile({
        available: artisan?.available ?? true,
        bio: artisan?.bio ?? "",
        skills: artisan?.skills ?? [],
        experience_years: artisan?.experience_years ?? 0,
        workshop_latitude: artisan?.workshop_latitude,
        workshop_longitude: artisan?.workshop_longitude,
        workshop_address: artisan?.workshop_address ?? "",
      });
      setOrderCount(orders.length);
      setRevenue(orders.reduce((s, o) => s + Number(o.total_price ?? 0), 0));
    } catch (err: any) {
      toast.error("Failed to load dashboard");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (user) { 
          setUserId(user._id); 
          await load(user._id); 
        }
      } catch (err) {
        toast.error("Failed to authenticate");
      }
    })();
  }, []);

  async function uploadProductImage(file: File, path: string) {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('path', path);
      formData.append('file', file);

      xhr.open('POST', '/api/storage/upload');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            return resolve(data.signedUrl as string);
          } catch (error) {
            return reject(new Error('Upload response parse failed'));
          }
        }
        let errorMessage = `Upload failed: ${xhr.status}`;
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.error) errorMessage = data.error;
        } catch {
          // ignore JSON parse errors
        }
        reject(new Error(errorMessage));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(formData);
    });
  }

  async function uploadProfileAvatar(file: File, path: string) {
    setAvatarUploading(true);
    try {
      const signedUrl = await uploadProductImage(file, path);
      setProfile((p) => ({ ...p, avatar_url: signedUrl }));
      setAvatarPreview("");
      toast.success('Avatar uploaded');
      return signedUrl;
    } catch (err: any) {
      toast.error(err?.message ?? 'Avatar upload failed');
      throw err;
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploadProgress(0);
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;

    try {
      const signedUrl = await uploadProductImage(file, path);
      setImageUrl(signedUrl);
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err?.message ?? 'Image upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleVariantFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const uploadColor = variantUploadColorRef.current;
    if (!file || !userId || !uploadColor) return;

    const localPreview = URL.createObjectURL(file);
    setVariantPreviewUrls((prev) => ({ ...prev, [uploadColor]: localPreview }));

    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/variants/${uploadColor}-${Date.now()}.${ext}`;

    try {
      const signedUrl = await uploadProductImage(file, path);
      setColorImages((prev) => ({ ...prev, [uploadColor]: signedUrl }));
      toast.success(`Uploaded ${uploadColor} variant image`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Variant upload failed');
    } finally {
      setUploading(false);
      setVariantUploadColor(null);
      variantUploadColorRef.current = null;
      if (e.target) e.target.value = '';
    }
  }

  function hexToRgb(hex: string) {
    const normalized = hex.replace(/[^0-9a-f]/gi, "");
    const value = normalized.length === 3
      ? normalized.split("").map((c) => c + c).join("")
      : normalized;
    const intVal = parseInt(value, 16);
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255,
    };
  }

  function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r: h = ((g - b) / delta) % 6; break;
        case g: h = (b - r) / delta + 2; break;
        case b: h = (r - g) / delta + 4; break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s, l };
  }

  function hslToRgb(h: number, s: number, l: number) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rr = 0; let gg = 0; let bb = 0;
    if (h >= 0 && h < 60) { rr = c; gg = x; bb = 0; }
    else if (h >= 60 && h < 120) { rr = x; gg = c; bb = 0; }
    else if (h >= 120 && h < 180) { rr = 0; gg = c; bb = x; }
    else if (h >= 180 && h < 240) { rr = 0; gg = x; bb = c; }
    else if (h >= 240 && h < 300) { rr = x; gg = 0; bb = c; }
    else { rr = c; gg = 0; bb = x; }
    return {
      r: Math.round((rr + m) * 255),
      g: Math.round((gg + m) * 255),
      b: Math.round((bb + m) * 255),
    };
  }

  function sampleBackgroundColor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const sampleSize = 6;
    const pixels: number[][] = [];
    const addSample = (x: number, y: number) => {
      const data = ctx.getImageData(x, y, 1, 1).data;
      if (data[3] > 64) pixels.push([data[0], data[1], data[2]]);
    };
    for (let x = 0; x < sampleSize; x += 2) {
      for (let y = 0; y < sampleSize; y += 2) {
        addSample(x, y);
        addSample(width - x - 1, y);
        addSample(x, height - y - 1);
        addSample(width - x - 1, height - y - 1);
      }
    }
    if (!pixels.length) return { r: 255, g: 255, b: 255 };
    const avg = pixels.reduce((acc, [r, g, b]) => {
      acc.r += r; acc.g += g; acc.b += b; return acc;
    }, { r: 0, g: 0, b: 0 });
    return { r: avg.r / pixels.length, g: avg.g / pixels.length, b: avg.b / pixels.length };
  }

  function hueDistance(a: number, b: number) {
    const diff = Math.abs(a - b);
    return Math.min(diff, 360 - diff);
  }

  function isBackgroundPixel(pixel: [number, number, number], bg: { r: number; g: number; b: number }) {
    return Math.hypot(pixel[0] - bg.r, pixel[1] - bg.g, pixel[2] - bg.b) < 40;
  }

  function isSkinTone(hsl: { h: number; s: number; l: number }) {
    return hsl.h >= 0 && hsl.h <= 60 && hsl.s >= 0.12 && hsl.s <= 0.62 && hsl.l >= 0.28 && hsl.l <= 0.78;
  }

  function isHairTone(hsl: { h: number; s: number; l: number }) {
    return (hsl.l < 0.18 && hsl.s < 0.55) || (hsl.h >= 15 && hsl.h <= 60 && hsl.s < 0.22 && hsl.l < 0.38);
  }

  function isNeutralShade(hsl: { h: number; s: number; l: number }) {
    return hsl.s < 0.1 && hsl.l >= 0.12 && hsl.l <= 0.92;
  }

  function targetIsBlack(targetHsl: { h: number; s: number; l: number }) {
    return targetHsl.l < 0.14;
  }

  function targetIsWhite(targetHsl: { h: number; s: number; l: number }) {
    return targetHsl.l > 0.9;
  }

  function recolorHsl(originalHsl: { h: number; s: number; l: number }, targetHsl: { h: number; s: number; l: number }) {
    if (targetIsBlack(targetHsl)) {
      return {
        h: targetHsl.h,
        s: Math.min(0.12, originalHsl.s * 0.15),
        l: Math.max(0.05, originalHsl.l * 0.18),
      };
    }

    if (targetIsWhite(targetHsl)) {
      return {
        h: targetHsl.h,
        s: Math.min(0.08, originalHsl.s * 0.12),
        l: Math.min(0.98, Math.max(0.92, originalHsl.l + 0.28)),
      };
    }

    return {
      h: targetHsl.h,
      s: Math.min(0.98, Math.max(0.28, originalHsl.s * 0.75 + targetHsl.s * 0.25)),
      l: Math.min(0.92, Math.max(0.14, originalHsl.l * 0.88 + 0.06 + (targetHsl.l - 0.5) * 0.1)),
    };
  }

  function computeDominantTextileHue(imageData: ImageData, bg: { r: number; g: number; b: number }) {
    const bins = Array.from({ length: 36 }, () => ({ count: 0, h: 0, s: 0, l: 0 }));
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 32) continue;
      const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
      if (isBackgroundPixel(rgb, bg)) continue;
      const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      if (isSkinTone(hsl) || isHairTone(hsl) || isNeutralShade(hsl)) continue;
      if (hsl.l < 0.06 || hsl.l > 0.92) continue;
      if (hsl.s < 0.12) continue;
      const binIndex = Math.floor(hsl.h / 10) % 36;
      bins[binIndex].count += 1;
      bins[binIndex].h += hsl.h;
      bins[binIndex].s += hsl.s;
      bins[binIndex].l += hsl.l;
    }

    let best = { count: 0, h: 0, s: 0, l: 0 };
    for (const bin of bins) {
      if (bin.count > best.count) best = bin;
    }
    if (best.count === 0) return null;
    return {
      h: best.h / best.count,
      s: best.s / best.count,
      l: best.l / best.count,
    };
  }

  function largestConnectedMask(mask: Uint8Array, width: number, height: number) {
    const seen = new Uint8Array(mask.length);
    const directions = [-1, 1, -width, width];
    let bestStart = -1;
    let bestSize = 0;

    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || seen[start]) continue;
      let size = 0;
      const queue = [start];
      seen[start] = 1;

      while (queue.length > 0) {
        const idx = queue.pop()!;
        size += 1;
        const x = idx % width;
        const y = Math.floor(idx / width);

        for (const dir of directions) {
          const next = idx + dir;
          if (next < 0 || next >= mask.length) continue;
          const nx = next % width;
          const ny = Math.floor(next / width);
          if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
          if (mask[next] && !seen[next]) {
            seen[next] = 1;
            queue.push(next);
          }
        }
      }

      if (size > bestSize) {
        bestSize = size;
        bestStart = start;
      }
    }

    if (bestStart < 0) return mask;

    const result = new Uint8Array(mask.length);
    const queue = [bestStart];
    result[bestStart] = 1;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      const x = idx % width;
      const y = Math.floor(idx / width);
      for (const dir of directions) {
        const next = idx + dir;
        if (next < 0 || next >= mask.length) continue;
        const nx = next % width;
        const ny = Math.floor(next / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        if (mask[next] && !result[next]) {
          result[next] = 1;
          queue.push(next);
        }
      }
    }

    return result;
  }

  function buildSareeMask(imageData: ImageData, bg: { r: number; g: number; b: number }) {
    const dominant = computeDominantTextileHue(imageData, bg);
    const width = imageData.width;
    const height = imageData.height;
    const mask = new Uint8Array(width * height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      const a = data[i + 3];
      if (a < 32) continue;
      const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
      if (isBackgroundPixel(rgb, bg)) continue;
      const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      if (isSkinTone(hsl) || isHairTone(hsl)) continue;
      if (hsl.l < 0.06 || hsl.l > 0.92) continue;
      if (dominant) {
        if (hsl.s < 0.12) continue;
        if (hueDistance(hsl.h, dominant.h) > 90) continue;
      } else {
        if (hsl.s < 0.12) continue;
      }
      mask[idx] = 1;
    }

    const refined = largestConnectedMask(mask, width, height);
    const maskCount = refined.reduce((sum, value) => sum + value, 0);
    if (maskCount < width * height * 0.01) {
      const fallback = new Uint8Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        const a = data[i + 3];
        if (a < 32) continue;
        const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
        if (isBackgroundPixel(rgb, bg)) continue;
        const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        if (isSkinTone(hsl) || isHairTone(hsl)) continue;
        if (hsl.l < 0.08 || hsl.l > 0.92) continue;
        if (hsl.s < 0.12) continue;
        fallback[idx] = 1;
      }
      return largestConnectedMask(fallback, width, height);
    }

    return refined;
  }

  // Automatic color-variant generation removed. Use manual per-color uploads instead.

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const variantImages = colors.length > 0
      ? colors.map((c) => colorImages[c] ?? imageUrl).filter(Boolean)
      : imageUrl
      ? [imageUrl]
      : [];
    const body = {
      title: form.title,
      description: form.description,
      price: Number(form.price) || 0,
      stock: Number(form.stock) || 0,
      category: form.category,
      images: variantImages.length ? variantImages : [],
      colors,
      sizes,
    };

    try {
      if (editingProductId) {
        await apiFetch(`/api/products/${encodeURIComponent(editingProductId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success("Product updated");
      } else {
        await apiFetch(`/api/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success("Product added");
      }
      setEditingProductId(null);
      setForm({ title: "", description: "", price: "", stock: "1", category: "artisan" });
      setImageUrl(""); setColors([]); setSizes([]);
      setColorImages({});
      setVariantPreviewUrls({});
      if (fileRef.current) fileRef.current.value = "";
      await load(userId);
    } catch (err: any) {
      toast.error(err?.message ?? 'Product save failed');
    }
  }

  function toggleColor(name: string) {
    setColors((c) => c.includes(name) ? c.filter((x) => x !== name) : [...c, name]);
  }
  function toggleSize(name: string) {
    setSizes((s) => s.includes(name) ? s.filter((x) => x !== name) : [...s, name]);
  }

  async function deleteProduct(id: string) {
    try {
      await apiFetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast.success("Deleted");
      if (userId) load(userId);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete product');
    }
  }

  async function toggleAvail(v: boolean) {
    if (!userId) return;
    setProfile((p) => ({ ...p, available: v }));
    try {
      await apiFetch(`/api/artisans/${encodeURIComponent(userId)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: v }),
      });
    } catch (err: any) {
      toast.error("Failed to update availability");
    }
  }

  async function saveProfile() {
    if (!userId) return;
    try {
      await apiFetch(`/api/artisans/${encodeURIComponent(userId)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: profile.bio,
          skills: profile.skills,
          workshop_latitude: profile.workshop_latitude ? Number(profile.workshop_latitude) : undefined,
          workshop_longitude: profile.workshop_longitude ? Number(profile.workshop_longitude) : undefined,
          workshop_address: profile.workshop_address,
          experience_years: profile.experience_years,
          avatar_url: profile.avatar_url ?? undefined,
        }),
      });
      toast.success("Profile saved");
    } catch (err: any) {
      toast.error(err?.message ?? 'Profile save failed');
    }
  }

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    setProfile((p) => ({ ...p, skills: [...p.skills, s] }));
    setSkillInput("");
  }

  return (
    <DashboardShell title="Artisan" navItems={dashboardNavItems}>
      <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">{sectionHeader.title}</h1>
            <p className="text-muted-foreground">{sectionHeader.description}</p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${profile.available ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            {profile.available ? "Available" : "Offline"}
            <Switch checked={profile.available} onCheckedChange={toggleAvail} />
          </div>
        </div>

        {activeSection === 'workshop' && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Products" value={products.length} />
              <Stat label="Orders" value={orderCount} />
              <Stat label="Revenue" value={`₹${revenue.toFixed(0)}`} />
            </div>

            <Card className="p-6" id="products">
              <h2 className="font-display text-xl">Add a product</h2>
              <form onSubmit={addProduct} className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Product image</Label>
              <div className="mt-1 flex items-center gap-4">
                <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
                  {(previewUrl || imageUrl) ? (
                    <div className="relative h-full w-full">
                      <img
                        src={previewUrl || imageUrl}
                        alt=""
                        onError={() => {
                          if (imageUrl) setImageUrl("");
                        }}
                        className="h-full w-full object-cover"
                      />
                      <button type="button" onClick={() => { setImageUrl(""); if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); setPreviewUrl(""); if (fileRef.current) fileRef.current.value = ""; }} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/80">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <Input ref={fileRef} type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="max-w-xs" />
                  {uploading ? (
                    <div className="space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">Uploading {uploadProgress}%</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Price (₹)</Label>
              <Input type="number" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <Label>Stock</Label>
              <Input type="number" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Available colors (upload a separate image per color variant)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => {
                  const on = colors.includes(c.name);
                  return (
                    <button key={c.name} type="button" onClick={() => toggleColor(c.name)}
                      className={`flex items-center gap-2 rounded-full border-2 px-3 py-1 text-xs transition ${on ? "border-primary bg-primary/5" : "border-border"}`}>
                      <span className="h-4 w-4 rounded-full border border-border" style={{ background: c.hex }} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {imageUrl && colors.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">Upload a dedicated product image for each color variant to preserve design, pattern, and texture.</span>
                </div>
              )}
              {colors.length > 0 && (
                <div className="mt-3 space-y-3">
                  {colors.map((color) => (
                    <div key={color} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {(variantPreviewUrls[color] || colorImages[color]) ? (
                          <img src={variantPreviewUrls[color] || colorImages[color]} alt={`${color} variant`} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">No image for {color}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium capitalize">{color}</div>
                        <div className="text-xs text-muted-foreground">Upload a dedicated product image for this color to preserve design, pattern, and texture.</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => { variantUploadColorRef.current = color; setVariantUploadColor(color); variantFileRef.current?.click(); }}>
                          {colorImages[color] ? "Replace" : "Upload"}
                        </Button>
                        {colorImages[color] && (
                          <Button type="button" variant="outline" onClick={() => setColorImages((prev) => { const next = { ...prev }; delete next[color]; return next; })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <input ref={variantFileRef} type="file" accept="image/*" onChange={handleVariantFile} className="hidden" />
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <Label>Available sizes (optional)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SIZE_PRESETS.map((s) => {
                  const on = sizes.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleSize(s)}
                      className={`min-w-[44px] rounded-md border-2 px-3 py-1 text-xs font-medium transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                {editingProductId ? "Update product" : "Add product"}
              </Button>
              {editingProductId ? (
                <Button type="button" variant="outline" onClick={() => {
                  setEditingProductId(null);
                  setForm({ title: "", description: "", price: "", stock: "1", category: "artisan" });
                  setImageUrl(""); setColors([]); setSizes([]);
                  setColorImages({}); setVariantPreviewUrls({});
                  if (fileRef.current) fileRef.current.value = "";
                }}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
        </>
        )}

        {activeSection === 'products' && (
          <Card className="p-6">
            <h2 className="font-display text-xl">Your products</h2>
            {products.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing yet — add your first product above.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="h-14 w-14 overflow-hidden rounded bg-muted">
                      {p.images?.[0] ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground capitalize">{p.category} · stock {p.stock}</div>
                      {p.description ? <div className="text-xs text-muted-foreground truncate">{p.description}</div> : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-primary font-semibold">₹{p.price}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setActiveSection('workshop');
                          setEditingProductId(p.id);
                          setForm({
                            title: p.title,
                            description: p.description ?? "",
                            price: String(p.price),
                            stock: String(p.stock),
                            category: p.category,
                          });
                          setColors(p.colors ?? []);
                          setSizes(p.sizes ?? []);
                          if (p.colors?.length && p.images?.length) {
                            setColorImages(p.colors.reduce((acc, color, index) => ({
                              ...acc,
                              [color]: p.images[index] ?? "",
                            }), {} as Record<string, string>));
                          } else {
                            setImageUrl(p.images?.[0] ?? "");
                            setColorImages({});
                          }
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteProduct(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeSection === 'profile' && (
          <Card className="p-6" id="profile">
            <h2 className="font-display text-xl">Profile</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Bio</Label>
              <Textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
            </div>
            <div>
              <Label>Experience (years)</Label>
              <Input type="number" value={profile.experience_years} onChange={(e) => setProfile({ ...profile, experience_years: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <Label>Workshop Location</Label>
              <Textarea placeholder="E.g., 123 Main St, Workshop District, City" value={profile.workshop_address} onChange={(e) => setProfile({ ...profile, workshop_address: e.target.value })} className="mb-3" />
            </div>
            <div>
              <Label>Workshop Latitude</Label>
              <Input type="number" step="0.0001" placeholder="e.g., 17.3850" value={profile.workshop_latitude ?? ''} onChange={(e) => setProfile({ ...profile, workshop_latitude: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <Label>Workshop Longitude</Label>
              <Input type="number" step="0.0001" placeholder="e.g., 78.4867" value={profile.workshop_longitude ?? ''} onChange={(e) => setProfile({ ...profile, workshop_longitude: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <Label>Add skill</Label>
              <div className="flex gap-2">
                <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
                <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
              </div>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {(profile.skills ?? []).map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                  {s}
                  <button onClick={() => setProfile({ ...profile, skills: (profile.skills ?? []).filter((_, j) => j !== i) })}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-muted">
                    {(avatarPreview || profile.avatar_url) ? (
                      <img src={avatarPreview || profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f || !userId) return;
                    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
                    const pr = URL.createObjectURL(f); setAvatarPreview(pr);
                    const ext = f.name.split('.').pop() || 'jpg';
                    const path = `${userId}/avatar-${Date.now()}.${ext}`;
                    try { await uploadProfileAvatar(f, path); } catch {}
                    if (e.target) e.target.value = '';
                  }} />
                </div>
                <Button onClick={saveProfile} className="bg-primary hover:bg-primary/90">Save profile</Button>
              </div>
            </div>
          </div>
        </Card>
        )}
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold text-primary">{value}</div>
    </Card>
  );
}
