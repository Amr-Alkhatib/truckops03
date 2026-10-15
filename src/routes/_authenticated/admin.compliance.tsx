import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useReplan } from "@/hooks/use-replan";
import { CrudTable } from "@/components/admin/CrudTable";
import { useConfig } from "@/components/admin/ConfigForm";
import { supabase } from "@/integrations/supabase/client";
import { eur, formatDateDE, isSunday, crewOf } from "@/lib/engine";
import { fetchHolidaysBW, todayISO } from "@/lib/data";

function expiryBadge(d: string | null) {
  if (!d) return <span className="font-medium text-warning">enter date</span>;
  const today = todayISO();
  const in60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const cls = d < today ? "bg-destructive/15 text-destructive" : d <= in60 ? "bg-warning/25 text-warning-foreground dark:text-warning" : "bg-success/15 text-success";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{d < today ? "Expired " : d <= in60 ? "Renew soon · " : ""}{formatDateDE(d)}</span>;
}

export const Route = createFileRoute("/_authenticated/admin/compliance")({
  head: () => ({ meta: [{ title: "Compliance — TruckOps back office" }, { name: "description", content: "Company, truck and crew documents with legal basis." }] }),
  component: CompliancePage,
});

function CompliancePage() {
  const crews = useQuery({ queryKey: ["crud", "crews"], queryFn: async () => (await supabase.from("crews").select("*").order("name")).data ?? [] });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Compliance</h1>
      <p className="text-sm text-muted-foreground">
        Required company documents that expire before an event block the booking. Truck documents (TÜV, food registration) remove that truck from assignment. Crew documents (§43 IfSG refresher every 2 years) block that person. Corporate catering booked in advance is a <em>stehendes Gewerbe</em>; the Reisegewerbekarte (§55 GewO) is only needed for bookings flagged “sales to the public without prior order”.
      </p>
      <Onboarding />
      <CrudTable
        table="compliance_docs" title="Documents" order="doc_type" defaults={{ doc_type: "other", required: true, notes: "", status: "unverified", legal_basis: "" }}
        cols={[
          { key: "doc_type", label: "Type", type: "select", options: [
            { value: "gewerbeanmeldung", label: "Gewerbeanmeldung (seat Stuttgart)" },
            { value: "reisegewerbekarte", label: "Reisegewerbekarte (§55 GewO)" },
            { value: "food_registration", label: "Food registration Art. 6 VO 852/2004 (per truck)" },
            { value: "ifsg_belehrung", label: "§43 IfSG instruction / refresher (per person)" },
            { value: "tuev", label: "TÜV inspection" },
            { value: "liability_insurance", label: "Liability insurance" },
            { value: "gaststaetten_gestattung", label: "Gestattung §12 GastG" },
            { value: "vehicle_registration", label: "Vehicle keeper registration" },
            { value: "vehicle_insurance", label: "Vehicle insurance" },
            { value: "betriebsuebergang", label: "Staff transfer §613a BGB" },
            { value: "sondernutzung", label: "Sondernutzungserlaubnis" },
            { value: "other", label: "Other" },
          ] },
          { key: "label", label: "Label", type: "text" },
          { key: "truck_id", label: "Truck", type: "truck" },
          { key: "crew_member", label: "Crew member", type: "text" },
          { key: "expires_on", label: "Expires / due", type: "date", render: (r) => expiryBadge(r.expires_on) },
          { key: "renew_every_months", label: "Renew every (months)", type: "number", nullable: true, hideInTable: true },
          { key: "required", label: "Required", type: "bool" },
          { key: "onboarding", label: "Onboarding group", type: "text", hideInTable: true },
          { key: "done", label: "Onboarding item done", type: "bool", hideInTable: true },
          { key: "due_on", label: "Due", type: "date", hideInTable: true },
          { key: "legal_basis", label: "Legal basis", type: "text", hideInTable: true },
          { key: "source_url", label: "Source", type: "text", render: (r) => (r.source_url ? <a className="text-primary underline" href={r.source_url} target="_blank" rel="noreferrer">{r.source_title || "link"}</a> : "—") },
          { key: "source_title", label: "Source title", type: "text", hideInTable: true },
          { key: "status", label: "Status", type: "select", options: [{ value: "verified", label: "verified" }, { value: "unverified", label: "unverified" }], hideInTable: true },
          { key: "notes", label: "Notes", type: "text", hideInTable: true },
        ]}
      />
      <CrudTable
        table="crews" title="Crews" order="name" defaults={{ members: [], notes: "" }}
        cols={[
          { key: "name", label: "Crew", type: "text" },
          { key: "members", label: "Members", type: "tags" },
          { key: "notes", label: "Notes", type: "text" },
        ]}
      />
      <CrudTable
        table="truck_crew" title="Which crew runs which truck" order="truck_id" defaults={{ day_type: "all" }}
        cols={[
          { key: "truck_id", label: "Truck", type: "truck" },
          { key: "crew_id", label: "Crew", type: "select", options: (crews.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
          { key: "day_type", label: "Days", type: "select", options: [{ value: "all", label: "Every day" }, { value: "weekday", label: "Mon–Fri" }, { value: "weekend", label: "Sat/Sun" }] },
        ]}
      />
      <WorkingTime />
    </div>
  );
}

/** ArbZG §§10–11: ≥ 15 free Sundays per year; replacement rest day within 2 weeks. Minimum wage. */
function WorkingTime() {
  const cfg = useConfig();
  const year = Number(todayISO().slice(0, 4));
  const q = useQuery({
    queryKey: ["sunday-work", year],
    queryFn: async () => {
      const [a, tc, c, h] = await Promise.all([
        supabase.from("assignments").select("truck_id, event_date").gte("event_date", `${year}-01-01`).lte("event_date", `${year}-12-31`),
        supabase.from("truck_crew").select("truck_id, crew_id, day_type"),
        supabase.from("crews").select("id, name, members"),
        fetchHolidaysBW([year]),
      ]);
      const hol = new Set(h.map((x) => x.date));
      const perCrew = new Map<string, Set<string>>();
      for (const r of a.data ?? []) {
        if (!isSunday(r.event_date) && !hol.has(r.event_date)) continue;
        const crew = crewOf(r.truck_id, r.event_date, (tc.data ?? []) as any);
        perCrew.set(crew, (perCrew.get(crew) ?? new Set()).add(r.event_date));
      }
      return (c.data ?? []).map((cr) => ({ ...cr, days: [...(perCrew.get(cr.id) ?? [])].sort() }));
    },
  });
  const minFree = cfg.data?.min_free_sundays_per_year ?? 15;
  const wages: { from: string; eur: number }[] = cfg.data?.min_wage ?? [];
  return (
    <div className="glass rounded-3xl p-4 sm:p-6">
      <h2 className="mb-1 text-xl font-semibold">Working time & minimum wage</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        ArbZG: more than 6 h of work requires a 30-min break (§4) — that's why crews work max 6 h per event. Sunday/holiday work is allowed in hospitality, but each employee needs ≥ {minFree} free Sundays per year and a replacement rest day within 2 weeks (§§10–11).
      </p>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {wages.map((w) => <span key={w.from} className="rounded-full bg-accent px-3 py-1">Minimum wage from {formatDateDE(w.from)}: <strong>{eur(w.eur)}/h</strong></span>)}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="py-2">Crew</th><th>Members</th><th>Sundays/holidays worked {year}</th><th>Free Sundays left</th></tr></thead>
        <tbody>
          {(q.data ?? []).map((c) => {
            const free = 52 - c.days.filter((d) => isSunday(d)).length;
            return (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2">{c.name}</td>
                <td>{c.members.join(", ") || <span className="text-muted-foreground">add members</span>}</td>
                <td>{c.days.length ? c.days.map(formatDateDE).join(", ") : "—"}</td>
                <td className={free < minFree ? "font-semibold text-destructive" : free < minFree + 4 ? "text-warning" : ""}>{free}{free < minFree + 4 && " ⚠"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">Each listed day needs a replacement rest day within 2 weeks for every crew member who worked it.</p>
    </div>
  );
}

function Onboarding() {
  const qc = useQueryClient();
  const replan = useReplan();
  const q = useQuery({
    queryKey: ["onboarding-items"],
    queryFn: async () => (await supabase.from("compliance_docs").select("*, trucks(name)").not("onboarding", "is", null).order("due_on")).data ?? [],
  });
  const items = q.data ?? [];
  if (!items.length) return null;
  const groups = [...new Set(items.map((i) => i.onboarding as string))];
  const toggle = async (id: string, done: boolean) => {
    const { error } = await supabase.from("compliance_docs").update({ done }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["onboarding-items"] });
    qc.invalidateQueries({ queryKey: ["engine-static"] });
    replan("onboarding item updated");
  };
  const upload = async (id: string, file: File) => {
    const path = `onboarding/${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("permits").upload(path, file);
    if (up.error) return toast.error(up.error.message);
    await supabase.from("compliance_docs").update({ file_path: path }).eq("id", id);
    toast.success("Document uploaded");
    qc.invalidateQueries({ queryKey: ["onboarding-items"] });
  };
  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from("permits").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };
  return (
    <>
      {groups.map((g) => (
        <div key={g} className="glass rounded-3xl p-4 sm:p-6">
          <h2 className="mb-1 text-xl font-semibold capitalize">{g} onboarding</h2>
          <p className="mb-4 text-sm text-muted-foreground">Trucks with open required items show as “onboarding”: they can be quoted, but bookings with them can't be confirmed until their items are done.</p>
          <ul className="space-y-2 text-sm">
            {items.filter((i) => i.onboarding === g).map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-3 rounded-xl border p-3">
                <input type="checkbox" className="mt-1" checked={i.done} onChange={(e) => toggle(i.id, e.target.checked)} />
                <div className="min-w-0 flex-1">
                  <p className={i.done ? "line-through opacity-60" : "font-medium"}>{i.label}{!i.required && <span className="ml-1 text-xs font-normal text-muted-foreground">(info)</span>}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.legal_basis}{i.source_url && <> · <a className="text-primary underline" href={i.source_url} target="_blank" rel="noreferrer">source</a></>}
                    {i.due_on && ` · due ${formatDateDE(i.due_on)}`}{i.notes && ` · ${i.notes}`}
                  </p>
                </div>
                {i.file_path ? <Button size="sm" variant="outline" onClick={() => open(i.file_path!)}>Open document</Button> : null}
                <label className="cursor-pointer text-xs text-primary hover:underline">
                  {i.file_path ? "Replace" : "Upload"}
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(i.id, e.target.files[0])} />
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
