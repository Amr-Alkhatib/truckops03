import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todayISO } from "@/lib/data";
import { isInBlackout, weekdayName } from "@/lib/engine";

const addDays = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
};

/** Truck × day grid: who is out where. */
export function WeekGrid({ days = 14 }: { days?: number }) {
  const [start, setStart] = useState(() => todayISO());
  const end = addDays(start, days - 1);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const q = useQuery({
    queryKey: ["week-grid", start, days],
    queryFn: async () => {
      const [t, b, bo] = await Promise.all([
        supabase.from("trucks").select("id, name, status").order("name"),
        supabase.from("bookings").select("id, ref, event_date, truck_ids, venue_name, status").gte("event_date", start).lte("event_date", end).in("status", ["awaiting_approval", "confirmed", "completed"]),
        supabase.from("truck_blackouts").select("*"),
      ]);
      return { trucks: t.data ?? [], bookings: b.data ?? [], blackouts: bo.data ?? [] };
    },
  });
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Fleet calendar</h2>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setStart(addDays(start, -7))}><ChevronLeft /></Button>
          <Button size="sm" variant="ghost" onClick={() => setStart(todayISO())}>Today</Button>
          <Button size="icon" variant="ghost" onClick={() => setStart(addDays(start, 7))}><ChevronRight /></Button>
        </div>
      </div>
      {q.isLoading ? <Skeleton className="h-64" /> : (
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead><tr><th className="sticky left-0 bg-card px-2 text-left">Truck</th>
              {dates.map((d) => <th key={d} className="min-w-14 px-1 py-1 font-medium text-muted-foreground">{weekdayName(d).slice(0, 2)}<br />{d.slice(8)}.{d.slice(5, 7)}</th>)}
            </tr></thead>
            <tbody>
              {q.data!.trucks.map((t) => (
                <tr key={t.id} className={t.status === "retired" ? "opacity-40" : ""}>
                  <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1 font-medium">{t.name}</td>
                  {dates.map((d) => {
                    const b = q.data!.bookings.find((x) => x.event_date === d && x.truck_ids.includes(t.id));
                    const bo = q.data!.blackouts.find((x) => x.truck_id === t.id && isInBlackout(d, x));
                    return (
                      <td key={d} className="p-0.5">
                        <div title={b ? `${b.ref} · ${b.venue_name}` : bo?.reason} className={`h-6 rounded ${b ? (b.status === "awaiting_approval" ? "bg-warning/60" : "bg-gradient-primary") : bo ? "bg-muted-foreground/30" : "bg-muted"}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Orange = booked · amber = awaiting approval · grey = blackout · faded = retired</p>
        </div>
      )}
    </div>
  );
}
