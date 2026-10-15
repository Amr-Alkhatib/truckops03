import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, STATUS_LABELS } from "@/components/StatusBadge";
import { eur, formatDateDE } from "@/lib/engine";

export const Route = createFileRoute("/_authenticated/admin/bookings/")({ component: AdminBookings });

function AdminBookings() {
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [town, setTown] = useState("");
  const q = useQuery({
    queryKey: ["admin-bookings", status, from, to, town],
    queryFn: async () => {
      let qq = supabase.from("bookings").select("id, ref, status, event_date, start_time, venue_name, town, company_name, guests, total_gross").order("event_date", { ascending: false });
      if (status) qq = qq.eq("status", status as any);
      if (from) qq = qq.gte("event_date", from);
      if (to) qq = qq.lte("event_date", to);
      if (town) qq = qq.ilike("town", `%${town}%`);
      return (await qq).data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Bookings</h1>
      <div className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-4">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <Input placeholder="Town" value={town} onChange={(e) => setTown(e.target.value)} />
      </div>
      <div className="glass overflow-x-auto rounded-2xl p-2">
        {q.isLoading ? <Skeleton className="h-60" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground">
              {["Ref", "Date", "Venue", "Town", "Company", "Guests", "Gross", "Status"].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {q.data!.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="p-2"><Link to="/admin/bookings/$id" params={{ id: b.id }} className="font-medium text-primary hover:underline">{b.ref}</Link></td>
                  <td className="p-2">{formatDateDE(b.event_date)} {b.start_time.slice(0, 5)}</td>
                  <td className="p-2">{b.venue_name}</td><td className="p-2">{b.town}</td><td className="p-2">{b.company_name}</td>
                  <td className="p-2">{b.guests}</td><td className="p-2 tabular-nums">{eur(Number(b.total_gross))}</td>
                  <td className="p-2"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
              {!q.data!.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No bookings match.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
