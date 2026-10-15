import { createFileRoute } from "@tanstack/react-router";
import { CrudTable } from "@/components/admin/CrudTable";

export const Route = createFileRoute("/_authenticated/admin/towns")({
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Towns & permits</h1>
      <p className="text-sm text-muted-foreground">Public-ground bookings are only accepted for towns listed here. Unknown towns create a "needs review" lead.</p>
      <CrudTable
        table="towns" title="Town registry" order="name"
        defaults={{ permit_name: "Sondernutzungserlaubnis", issuing_authority: "Ordnungsamt", fee_model: "flat", fee_amount: 0, lead_time_weeks: 4, max_trucks: 4, generators_allowed: true, quiet_hours_mode: "warn", notes: "", contact: "" }}
        cols={[
          { key: "name", label: "Town", type: "text" },
          { key: "permit_name", label: "Permit", type: "text" },
          { key: "issuing_authority", label: "Authority", type: "text" },
          { key: "contact", label: "Contact / link", type: "text", hideInTable: true },
          { key: "fee_model", label: "Fee model", type: "select", options: [{ value: "flat", label: "Flat" }, { value: "per_truck", label: "Per truck" }, { value: "per_m2", label: "Per m²" }] },
          { key: "fee_amount", label: "Fee €", type: "number" },
          { key: "lead_time_weeks", label: "Lead weeks", type: "number" },
          { key: "max_trucks", label: "Max trucks", type: "number" },
          { key: "generators_allowed", label: "Generators OK", type: "bool" },
          { key: "quiet_hours_start", label: "Quiet from", type: "time", render: (r) => r.quiet_hours_start?.slice(0, 5) ?? "—" },
          { key: "quiet_hours_mode", label: "Quiet hours", type: "select", options: [{ value: "warn", label: "Warn" }, { value: "block", label: "Block" }] },
          { key: "notes", label: "Notes", type: "text", hideInTable: true },
          { key: "verified_on", label: "Verified on", type: "date", render: (r) => r.verified_on ? r.verified_on.split("-").reverse().join(".") : <span className="font-medium text-warning">verify</span> },
        ]}
      />
    </div>
  ),
});
