import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Clock, FileCheck2, MapPin, ShieldCheck, Sparkles, Users } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { eur, type EngineConfig } from "@/lib/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rolling Feast — Corporate food-truck catering in Stuttgart" },
      { name: "description", content: "Premium food-truck catering for company events across Baden-Württemberg. Get an instant, transparent quote in minutes." },
      { property: "og:title", content: "Rolling Feast — Corporate food-truck catering" },
      { property: "og:description", content: "Instant quotes for afterwork parties, summer fests and campus events around Stuttgart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: cfg, isLoading } = useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_config").select("config").eq("id", 1).single();
      if (error) throw error;
      return data.config as unknown as EngineConfig;
    },
  });

  return (
    <div className="min-h-screen">
      <section className="relative min-h-[92vh] overflow-hidden">
        <img src={hero} alt="Rolling Feast food trucks at a corporate rooftop afterwork party at dusk" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-hero" />
        <SiteHeader overlay />
        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-4 pb-16 pt-32 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-2xl text-ink-foreground">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink-foreground/20 px-3 py-1 text-xs uppercase tracking-[0.2em]">
              <MapPin className="size-3" /> Stuttgart · Baden-Württemberg
            </p>
            <h1 className="text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
              Street food, <em className="text-gradient not-italic">served corporate.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg opacity-80">
              Rolling Feast brings a curated fleet of food trucks to your campus, rooftop or square — with permits, power and crew sorted. One click, one honest quote.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg" className="h-12 px-7 text-base">
                <Link to="/book">{t("Get an instant quote")} <ArrowRight /></Link>
              </Button>
              <Button asChild variant="glass" size="lg" className="h-12 px-7 text-base">
                <Link to="/login">Planner sign in</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="glass mt-12 w-full max-w-sm rounded-3xl p-6 lg:mt-0">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                <Sparkles className="size-3" /> {t("Best-seller")}
              </span>
              <Clock className="size-4 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-3xl font-semibold">{best?.name ?? "Afterwork Party"}</h2>
            {isLoading ? (
              <Skeleton className="mt-2 h-5 w-40" />
            ) : (
              <p className="mt-1 text-muted-foreground">
                {best?.start_time.slice(0, 5)}–{best?.end_time.slice(0, 5)} · from {eur(cfg?.per_guest_price ?? 0)} net / guest
              </p>
            )}
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex gap-2"><Users className="size-4 text-primary" /> Auto-matched trucks for your guest count & diets</li>
              <li className="flex gap-2"><FileCheck2 className="size-4 text-primary" /> Permits and second crew shift included in the quote</li>
              <li className="flex gap-2"><ShieldCheck className="size-4 text-primary" /> Fixed road distance — no surprises</li>
            </ul>
            <Button asChild variant="hero" className="mt-6 w-full">
              <Link to="/book" search={{ package: best?.slug ?? "afterwork" }}>{t("Book the Afterwork Party")}</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-20 sm:px-6 md:grid-cols-3">
        {[
          { t: "10 trucks, one plan", d: "Burgers, tacos, pho, vegan bowls and more — our optimiser sends the fewest trucks that cover every guest and diet." },
          { t: "Permits handled", d: "We know the Sondernutzungserlaubnis rules town by town, and quote the fees at cost." },
          { t: "Approval built in", d: "Bigger orders get a one-click approval link for your finance colleague. No account needed." },
        ].map((f, i) => (
          <motion.div key={f.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="glass rounded-2xl p-6">
            <h3 className="text-xl font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
          </motion.div>
        ))}
      </section>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Rolling Feast Event Catering · Depot Stuttgart city centre
      </footer>
    </div>
  );
}
