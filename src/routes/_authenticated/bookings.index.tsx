import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { eur, formatDateDE } from "@/lib/engine";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/bookings/")({
  head: () => ({ meta: [{ title: "My bookings — TruckOps" }, { name: "description", content: "Your Rolling Feast bookings and their status." }] }),
  component: MyBookings,
});

function MyBookings() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("bookings").select("id, ref, status, event_date, start_time, end_time, venue_name, guests, total_gross").eq("user_id", user!.id).order("event_date", { ascending: false })).data ?? [],
  });
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">My bookings</h1>
        <Button variant="hero" asChild><Link to="/book"><Plus /> New booking</Link></Button>
      </div>
      {q.isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : q.data?.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">No bookings yet. Your first quote takes about two minutes.</div>
      ) : (
        <div className="space-y-3">
          {q.data!.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to="/bookings/$id" params={{ id: b.id }} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
                <div>
                  <p className="font-semibold">{b.venue_name}</p>
                  <p className="text-sm text-muted-foreground">{b.ref} · {formatDateDE(b.event_date)} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)} · {b.guests} guests</p>
                </div>
                <div className="flex items-center gap-4"><StatusBadge status={b.status} /><span className="font-display text-lg tabular-nums">{eur(Number(b.total_gross))}</span></div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}
