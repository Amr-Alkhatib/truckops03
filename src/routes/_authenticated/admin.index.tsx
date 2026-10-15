import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { eur, formatDateDE } from "@/lib/engine";
import { todayISO } from "@/lib/data";
import { WeekGrid } from "@/components/admin/WeekGrid";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

function Dashboard() {
  const q = useQuery({
    queryKey: ["admin-kpis"],
    queryFn: async () => {
      const today = todayISO();
      const [b, l, t] = await Promise.all([
        supabase.from("bookings").select("id, ref, status, event_date, total_net, total_gross, truck_ids, venue_name"),
        supabase.from("leads").select("id, reason, town, created_at, status").eq("status", "needs_review"),
        supabase.from("trucks").select("id, is_addon, status"),
      ]);
      const bookings = b.data ?? [];
      const live = bookings.filter((x) => ["confirmed", "completed", "awaiting_approval"].includes(x.status));
      const upcoming = live.filter((x) => x.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
      const revenue = bookings.filter((x) => ["confirmed", "completed"].includes(x.status));
      const fleet = (t.data ?? []).filter((x) => x.status === "active" && !x.is_addon).length;
      const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const truckDays = upcoming.filter((x) => x.event_date <= in30).reduce((s, x) => s + x.truck_ids.length, 0);
      return {
        upcoming, leads: l.data ?? [],
        net: revenue.reduce((s, x) => s + Number(x.total_net), 0),
        gross: revenue.reduce((s, x) => s + Number(x.total_gross), 0),
        pending: bookings.filter((x) => x.status === "awaiting_approval").length,
        util: fleet ? Math.round((truckDays / (fleet * 30)) * 100) : 0,
      };
    },
  });
  if (q.isLoading) return <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  const d = q.data!;
  const kpis = [
    ["Upcoming events", d.upcoming.length],
    ["Revenue (net)", eur(d.net)],
    ["Revenue (gross)", eur(d.gross)],
    ["Approvals pending", d.pending],
    ["Needs-review leads", d.leads.length],
    ["Fleet utilization (30 d)", `${d.util}%`],
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map(([k, v], i) => (
          <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{v}</p>
          </motion.div>
        ))}
      </div>
      <WeekGrid />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-semibold">Next events</h2>
          {d.upcoming.slice(0, 8).map((b) => (
            <Link key={b.id} to="/admin/bookings/$id" params={{ id: b.id }} className="flex justify-between border-b py-2 text-sm last:border-0 hover:text-primary">
              <span>{formatDateDE(b.event_date)} · {b.venue_name}</span><span className="tabular-nums">{eur(Number(b.total_gross))}</span>
            </Link>
          ))}
          {!d.upcoming.length && <p className="text-sm text-muted-foreground">No upcoming events.</p>}
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-semibold">Leads needing review</h2>
          {d.leads.map((l) => <p key={l.id} className="border-b py-2 text-sm last:border-0">{l.town}: {l.reason}</p>)}
          {!d.leads.length && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
        </div>
      </div>
    </div>
  );
}
