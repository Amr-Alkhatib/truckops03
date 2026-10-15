import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CrudTable } from "@/components/admin/CrudTable";
import { YardsMap } from "@/components/admin/YardsMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/Field";
import { DateInputDE } from "@/components/DateInputDE";
import { useStaticData } from "@/hooks/use-engine";
import { useReplan } from "@/hooks/use-replan";
import { addDays, formatDateDE, planDay, yardOf, type TruckYard } from "@/lib/engine";
import { makeContext, mapDayBooking, todayISO } from "@/lib/data";
import { roadDistance } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/admin/yards")({
  head: () => ({ meta: [{ title: "Yards — TruckOps back office" }, { name: "description", content: "Yards, their trucks and truck moves." }] }),
  component: YardsPage,
});

type Move = { truckId: string; yardId: string };
type Preview = { dates: string[]; reassigned: number; conflicts: number; lines: string[] };

function YardsPage() {
  const s = useStaticData();
  const today = todayISO();
  const [move, setMove] = useState<Move | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const upcoming = useQuery({
    queryKey: ["yard-upcoming"],
    queryFn: async () => (await supabase.from("assignments").select("truck_id, event_date").gte("event_date", today).order("event_date").limit(500)).data ?? [],
  });
  const history = useQuery({
    queryKey: ["yard-history"],
    queryFn: async () => (await supabase.from("truck_yard_assignments").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  if (!s.data) return <Skeleton className="h-96 rounded-3xl" />;
  const { yards, trucks, onboardingOpen, config } = s.data;
  const yardName = (id: string) => yards.find((y) => y.id === id)?.name ?? "?";
  const truckName = (id: string) => trucks.find((t) => t.id === id)?.name ?? "?";
  const ctxToday = makeContext(s.data, { occupiedTruckIds: [], compliance: [], bookings: [], holidays: [] });
  // board shows where each truck is today, or its first future yard
  const homeOf = (truckId: string) => {
    const y = yardOf(ctxToday, truckId, today);
    if (y) return { yard: y.id, from: null as string | null };
    const next = s.data!.truckYards.filter((a) => a.truck_id === truckId && a.valid_from > today).sort((a, b) => a.valid_from.localeCompare(b.valid_from))[0];
    return next ? { yard: next.yard_id, from: next.valid_from } : { yard: "", from: null };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Yards</h1>
      <p className="text-sm text-muted-foreground">Every truck leaves from its own yard. A truck is only sent to venues within {config.max_distance_km} km by road of its yard, and travel is charged per truck from its yard. Drag a truck to another yard (or use “Move”) — you'll see which bookings are affected before saving.</p>
      <YardsMap yards={yards} radiusKm={config.max_distance_km} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {yards.map((y) => (
          <div
            key={y.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag && homeOf(drag).yard !== y.id) setMove({ truckId: drag, yardId: y.id }); setDrag(null); }}
            className={`glass rounded-3xl p-4 ${drag ? "ring-2 ring-primary/40" : ""}`}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{y.name}</h2>
              <span className="text-xs text-muted-foreground">{y.status}{y.active_from ? ` · opens ${formatDateDE(y.active_from)}` : ""} · relief crews {y.relief_crews}</span>
            </div>
            <ul className="space-y-2">
              {trucks.filter((t) => t.status !== "retired" && homeOf(t.id).yard === y.id).map((t) => {
                const h = homeOf(t.id);
                const onb = onboardingOpen.filter((o) => o.truck_id === t.id).length;
                const next = (upcoming.data ?? []).filter((a) => a.truck_id === t.id).slice(0, 3).map((a) => formatDateDE(a.event_date));
                return (
                  <li key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} className="flex cursor-grab items-start gap-2 rounded-xl border bg-background/60 p-3 text-sm">
                    <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name} <span className="font-normal text-muted-foreground">· {t.cuisine}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {[t.vegan && "vegan", (t.vegetarian || t.vegan) && "vegetarian", t.gluten_free && "gluten-free", t.halal && "halal", t.is_addon && "add-on"].filter(Boolean).join(" · ") || "—"}
                        {h.from && ` · from ${formatDateDE(h.from)}`}
                        {onb > 0 && <span className="ml-1 rounded-full bg-warning/25 px-1.5 font-semibold">onboarding ({onb} open)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{next.length ? `Next: ${next.join(", ")}` : "No upcoming bookings"}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setMove({ truckId: t.id, yardId: yards.find((x) => x.id !== y.id)?.id ?? y.id })}><ArrowRightLeft /> Move</Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {move && <MoveDialog move={move} onClose={() => setMove(null)} yards={yards} truckName={truckName} />}

      <CrudTable
        table="yards" title="Yards" order="created_at" allowDelete={false}
        defaults={{ name: "", address: "", status: "active", relief_crews: 0, notes: "" }}
        cols={[
          { key: "name", label: "Name", type: "text" },
          { key: "address", label: "Address", type: "text" },
          { key: "lat", label: "Latitude", type: "number" },
          { key: "lon", label: "Longitude", type: "number" },
          { key: "active_from", label: "Active from", type: "date", render: (r) => (r.active_from ? formatDateDE(r.active_from) : "—") },
          { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "active" }, { value: "planned", label: "planned" }, { value: "closed", label: "closed" }] },
          { key: "relief_crews", label: "Relief crews / day", type: "number" },
          { key: "notes", label: "Notes", type: "text", hideInTable: true },
        ]}
      />

      <div className="glass rounded-3xl p-4 sm:p-6">
        <h2 className="mb-3 text-xl font-semibold">Truck move history</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="py-2">Truck</th><th>Yard</th><th>From</th><th>Until</th><th>By</th><th>Note</th></tr></thead>
          <tbody>
            {(history.data ?? []).map((h) => (
              <tr key={h.id} className="border-b last:border-0">
                <td className="py-2">{truckName(h.truck_id)}</td><td>{yardName(h.yard_id)}</td><td>{formatDateDE(h.valid_from)}</td>
                <td>{h.valid_to ? formatDateDE(h.valid_to) : "open"}</td><td>{h.moved_by}</td><td className="text-muted-foreground">{h.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoveDialog({ move, onClose, yards, truckName }: { move: Move; onClose: () => void; yards: { id: string; name: string }[]; truckName: (id: string) => string }) {
  const s = useStaticData();
  const qc = useQueryClient();
  const replan = useReplan();
  const [yardId, setYardId] = useState(move.yardId);
  const [from, setFrom] = useState(addDays(todayISO(), 1));
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const simulate = async () => {
    if (!s.data || !from) return;
    setBusy(true);
    try {
      const { data: rows, error } = await supabase.rpc("day_bookings", { _from: from, _to: addDays(from, 365) });
      if (error) throw error;
      const bookings = (rows ?? []).map(mapDayBooking);
      // measure missing yard distances (e.g. bookings never measured from this yard)
      const missing = bookings.filter((b) => !(yardId in (b.input?.yard_km ?? {})));
      if (missing.length) {
        const { data: ll } = await supabase.from("bookings").select("id, lat, lon").in("id", missing.map((m) => m.id));
        const y = s.data.yards.find((x) => x.id === yardId)!;
        for (const r of ll ?? []) {
          const b = missing.find((m) => m.id === r.id)!;
          try { b.input!.yard_km = { ...(b.input!.yard_km ?? {}), [yardId]: (await roadDistance(y, { lat: r.lat, lon: r.lon })).km }; } catch { /* unknown */ }
        }
      }
      const moved: TruckYard[] = s.data.truckYards
        .map((a) => (a.truck_id === move.truckId && a.valid_from < from && (!a.valid_to || a.valid_to >= from) ? { ...a, valid_to: addDays(from, -1) } : a))
        .filter((a) => !(a.truck_id === move.truckId && a.valid_from >= from))
        .concat([{ truck_id: move.truckId, yard_id: yardId, valid_from: from, valid_to: null }]);
      const ctx = makeContext({ ...s.data, truckYards: moved }, { occupiedTruckIds: [], compliance: [], bookings, holidays: [] });
      const dates = [...new Set(bookings.map((b) => b.event_date))].sort();
      let reassigned = 0, conflicts = 0;
      const lines: string[] = [];
      const affected: string[] = [];
      for (const d of dates) {
        const p = planDay(d, ctx);
        const newConf = p.conflicts.filter((c) => bookings.find((b) => b.id === c.id)?.status !== "conflict");
        if (p.changed.length || newConf.length) affected.push(d);
        reassigned += p.changed.length;
        conflicts += newConf.length;
        for (const id of p.changed) lines.push(`${formatDateDE(d)}: re-assigned to ${p.assign[id].map(truckName).join(" + ")}`);
        for (const c of newConf) lines.push(`${formatDateDE(d)}: would become Conflict — ${c.reason}`);
      }
      setPreview({ dates: affected.length ? affected : dates, reassigned, conflicts, lines });
    } catch (e: any) {
      toast.error(e?.message ?? "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("move_truck_to_yard", { _truck: move.truckId, _yard: yardId, _from: from, _note: note });
    if (error) { setBusy(false); return toast.error(error.message); }
    toast.success(`${truckName(move.truckId)} moves to ${yards.find((y) => y.id === yardId)?.name} from ${formatDateDE(from)}`);
    qc.invalidateQueries();
    await replan(`${truckName(move.truckId)} moved to ${yards.find((y) => y.id === yardId)?.name}`, preview?.dates);
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Move {truckName(move.truckId)}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <Field label="To yard">
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={yardId} onChange={(e) => { setYardId(e.target.value); setPreview(null); }}>
              {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
          <Field label="Effective from"><DateInputDE value={from} onChange={(v) => { setFrom(v); setPreview(null); }} /></Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. covers Heilbronn demand in November" /></Field>
          {preview && (
            <div className="rounded-xl border p-3 text-sm">
              <p className="font-medium">{preview.reassigned + preview.conflicts === 0 ? "No upcoming bookings are affected." : `${preview.reassigned + preview.conflicts} upcoming booking(s) affected: ${preview.reassigned} re-assigned, ${preview.conflicts} would become Conflict.`}</p>
              <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-muted-foreground">{preview.lines.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          )}
          {!preview ? (
            <Button variant="hero" disabled={busy || !from} onClick={simulate}>{busy ? "Checking bookings…" : "Preview affected bookings"}</Button>
          ) : (
            <Button variant="hero" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save move and re-plan"}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
