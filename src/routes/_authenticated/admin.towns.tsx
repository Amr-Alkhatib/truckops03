import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CrudTable } from "@/components/admin/CrudTable";
import { supabase } from "@/integrations/supabase/client";
import { formatDateDE } from "@/lib/engine";

const status = (v: string) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v === "verified" ? "bg-success/15 text-success" : "bg-warning/25"}`}>{v}</span>;

export const Route = createFileRoute("/_authenticated/admin/towns")({
  head: () => ({ meta: [{ title: "Towns & permits — TruckOps back office" }, { name: "description", content: "Sourced permit registry per town." }] }),
  component: TownsPage,
});

function TownsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Towns & permits</h1>
      <p className="text-sm text-muted-foreground">
        Every value has a source. Unknown values stay empty — never guessed. Public-ground bookings in an unverified town, or with an unknown fee or lead time, still get a quote, but go to <strong>Permit check</strong> until staff records the permit. Unknown towns are added automatically from the address search.
      </p>
      <CrudTable
        table="towns" title="Town registry" order="name"
        defaults={{ permit_name: "Sondernutzungserlaubnis", issuing_authority: "Ordnungsamt", fee_model: "unknown", fee_amount: 0, lead_time_weeks: 0, max_trucks: 99, generators_allowed: true, quiet_hours_mode: "warn", notes: "", contact: "", status: "unverified", night_warn_from: "22:00" }}
        cols={[
          { key: "name", label: "Town", type: "text" },
          { key: "landkreis", label: "Landkreis", type: "text" },
          { key: "status", label: "Status", type: "select", options: [{ value: "verified", label: "verified" }, { value: "unverified", label: "unverified" }], render: (r) => status(r.status) },
          { key: "permit_name", label: "Permit", type: "text", hideInTable: true },
          { key: "authority_name", label: "Authority", type: "text" },
          { key: "authority_address", label: "Authority address", type: "text", hideInTable: true },
          { key: "authority_phone", label: "Phone", type: "text", hideInTable: true },
          { key: "authority_email", label: "Email", type: "text", hideInTable: true },
          { key: "legal_basis", label: "Legal basis", type: "text", hideInTable: true },
          { key: "fee_model", label: "Fee model", type: "select", options: [
            { value: "per_started_3m2_per_day", label: "Per started 3 m² per day (street groups)" },
            { value: "per_started_m2_per_day", label: "Per started m² per day" },
            { value: "per_truck", label: "Per truck" }, { value: "flat", label: "Flat" }, { value: "unknown", label: "Unknown" },
          ] },
          { key: "fee_value", label: "Fee €", type: "number", nullable: true, render: (r) => r.fee_model === "per_started_3m2_per_day" ? Object.entries(r.fee_table?.groups ?? {}).map(([g, v]) => `${g}: €${v}`).join(" · ") : r.fee_value ?? <span className="text-warning">unknown</span> },
          { key: "min_fee", label: "Min fee €", type: "number", nullable: true, hideInTable: true },
          { key: "lead_weeks", label: "Lead weeks", type: "number", nullable: true, render: (r) => r.lead_weeks ?? <span className="text-warning">not published</span> },
          { key: "max_trucks", label: "Max trucks", type: "number", hideInTable: true },
          { key: "generators_allowed", label: "Generators OK", type: "bool" },
          { key: "night_warn_from", label: "Night warning from", type: "time", hideInTable: true },
          { key: "source_url", label: "Source", type: "text", render: (r) => r.source_url ? <a className="text-primary underline" href={r.source_url} target="_blank" rel="noreferrer">{r.source_title || "link"}</a> : <span className="text-warning">none</span> },
          { key: "source_title", label: "Source title", type: "text", hideInTable: true },
          { key: "verified_on", label: "Checked on", type: "date", render: (r) => r.verified_on ? formatDateDE(r.verified_on) : "—" },
          { key: "notes", label: "Notes", type: "text", hideInTable: true },
        ]}
      />
      <Checklists />
    </div>
  );
}

function Checklists() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["town-checklists"],
    queryFn: async () => (await supabase.from("town_checklist").select("*, towns(name)").order("sort")).data ?? [],
  });
  const byTown = new Map<string, any[]>();
  for (const r of q.data ?? []) byTown.set((r as any).towns?.name ?? "?", [...(byTown.get((r as any).towns?.name ?? "?") ?? []), r]);
  const toggle = async (id: string, done: boolean) => {
    await supabase.from("town_checklist").update({ done }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["town-checklists"] });
  };
  return (
    <div className="glass rounded-3xl p-4 sm:p-6">
      <h2 className="mb-1 text-xl font-semibold">New-town checklists</h2>
      <p className="mb-4 text-sm text-muted-foreground">Generated automatically the first time a town is used in a booking.</p>
      {!byTown.size && <p className="text-sm text-muted-foreground">No checklists yet.</p>}
      {[...byTown.entries()].map(([town, items]) => (
        <div key={town} className="mb-4">
          <h3 className="mb-2 font-semibold">{town}</h3>
          <ul className="space-y-1.5 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex gap-2">
                <input type="checkbox" checked={i.done} onChange={(e) => toggle(i.id, e.target.checked)} className="mt-1" />
                <span className={i.done ? "line-through opacity-60" : ""}>{i.item} <span className="text-muted-foreground">— {i.legal_basis}</span>{i.source_url && <> · <a className="text-primary underline" href={i.source_url} target="_blank" rel="noreferrer">source</a></>}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
