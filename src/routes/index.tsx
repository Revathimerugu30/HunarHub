import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteNavbar } from "@/components/site-navbar";
import { ArrowRight, Scissors, Hammer, Shirt, Palette, Store, Sparkles, Star } from "lucide-react";
import heroPottery from "@/assets/hero-pottery.jpg";
import craftTailor from "@/assets/craft-tailor.jpg";
import craftWeaver from "@/assets/craft-weaver.jpg";
import craftCobbler from "@/assets/craft-cobbler.jpg";
import craftHandmade from "@/assets/craft-handmade.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HunarHub — Marketplace for Indian Artisans" },
      { name: "description", content: "Build your craft or discover one. A premium marketplace for tailors, potters, weavers, cobblers and artisans across India." },
      { property: "og:title", content: "HunarHub — Marketplace for Indian Artisans" },
      { property: "og:description", content: "Build your craft or discover one." },
    ],
  }),
  component: Landing,
});

const categories = [
  { icon: Scissors, name: "Tailor", img: craftTailor },
  { icon: Hammer, name: "Potter", img: heroPottery },
  { icon: Shirt, name: "Weaver", img: craftWeaver },
  { icon: Palette, name: "Cobbler", img: craftCobbler },
  { icon: Store, name: "Vendor", img: craftHandmade },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-16 pb-24 md:grid-cols-2 md:items-center md:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" />
              India's marketplace for hand-crafted talent
            </div>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-7xl">
              Join <span className="text-primary">HunarHub</span>.
              <br />
              <span className="italic text-foreground/80">Build your craft</span>
              <br />
              or discover one.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              A premium digital home for tailors, potters, weavers, cobblers, and every Indian artisan with a story in their hands.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 shadow-warm">
                <Link to="/signup" search={{ role: "customer" } as never}>
                  I'm a Customer <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
                <Link to="/signup" search={{ role: "artisan" } as never}>
                  I'm an Artisan
                </Link>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
                <span className="ml-2 font-medium text-foreground">4.9</span>
              </div>
              <span>Trusted by 2,400+ artisans</span>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-warm">
              <img
                src={heroPottery}
                alt="Indian potter shaping clay on a wheel"
                width={1600}
                height={1200}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border bg-card p-4 shadow-warm md:block">
              <div className="text-xs text-muted-foreground">Latest order</div>
              <div className="mt-1 font-display text-lg">Hand-thrown terracotta vase</div>
              <div className="mt-1 text-sm text-primary">₹1,250 · Jaipur</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="border-t border-border/60 bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-primary">Categories</p>
              <h2 className="mt-2 font-display text-4xl font-semibold">Crafts that carry a country.</h2>
            </div>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((c) => (
              <div key={c.name} className="group relative overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:shadow-warm">
                <div className="aspect-[4/5] overflow-hidden">
                  <img
                    src={c.img}
                    alt={c.name}
                    loading="lazy"
                    width={800}
                    height={1000}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center gap-2 text-primary-foreground">
                    <c.icon className="h-4 w-4 text-gold" />
                    <span className="font-display text-lg">{c.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore CTA */}
      <section id="explore" className="py-24">
        <div className="mx-auto max-w-5xl rounded-3xl bg-gradient-sienna px-8 py-16 text-center text-primary-foreground shadow-warm">
          <h2 className="font-display text-4xl font-semibold text-balance md:text-5xl">
            Every order rebuilds a village workshop.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/85">
            Join thousands of customers supporting India's most skilled hands. Or open your own storefront in minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
              <Link to="/signup" search={{ role: "customer" }}>
                Get started — it's free
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} HunarHub · Crafted in India
      </footer>
    </div>
  );
}
