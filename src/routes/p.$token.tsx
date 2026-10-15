import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { BookingWizard, type PlannerLink } from "@/components/BookingWizard";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { eur, formatDateDE } from "@/lib/engine";

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Book food trucks — Rolling Feast" },
      { name: "description", content: "Book Rolling Feast food trucks with your team's booking link." },
      { property: "og:title", content: "Book food trucks — Rolling Feast" },
      { property: "og:description", content: "Book Rolling Feast food trucks with your team's booking link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TokenBooking,
});

function TokenBooking() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["planner-link", token],
    queryFn: async () => {
      const [l, b] = await Promise.all([supabase.rpc("get_planner_link", { _token: token }), supabase.rpc("get_planner_bookings", { _token: token })]);
      return { link: l.data as any, bookings: (b.data ?? []) as any[] };
    },
  });
  if (q.isLoading) return <div className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-3xl p-8"><Skeleton className="h-64 rounded-3xl" /></div></div>;
  if (!q.data?.link)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-3xl font-semibold">This booking link doesn't work</h1>
          <p className="mt-2 text-muted-foreground">It may have been turned off or expired. Ask the person who sent it for a new one, or create an account.</p>
          <Button asChild variant="hero" className="mt-6"><Link to="/signup">Create an account</Link></Button>
        </main>
      </div>
    );
  const link: PlannerLink = { token, ...q.data.link };
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <BookingWizard link={link} />
      {q.data.bookings.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <h2 className="mb-3 text-xl font-semibold">Bookings made with this link</h2>
          <div className="glass rounded-3xl p-4 text-sm">
            {q.data.bookings.map((b) => (
              <div key={b.ref} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                <span><strong>{b.ref}</strong> · {formatDateDE(b.event_date)} · {b.venue_name} · {b.guests} guests</span>
                <span className="flex items-center gap-3"><StatusBadge status={b.status} /> {eur(Number(b.total_gross))}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
