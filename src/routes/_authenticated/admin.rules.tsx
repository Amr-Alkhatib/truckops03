import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { CrudTable } from "@/components/admin/CrudTable";
import { ConfigForm } from "@/components/admin/ConfigForm";

const RULE_TYPES = [
  { value: "never_same_day", label: "Never out on the same day" },
  { value: "never_same_event", label: "Never at the same event" },
  { value: "max_one_of_group_on_weekend_day", label: "Max one per Sat/Sun" },
  { value: "allowed_together", label: "Allowed together" },
  { value: "min_clearance_route", label: "Min. clearance + HGV route check" },
  { value: "never_assign", label: "Never assignable" },
];

export const Route = createFileRoute("/_authenticated/admin/rules")({
  head: () => ({ meta: [{ title: "Rules — TruckOps back office" }, { name: "description", content: "Crew, pairing and system rules." }] }),
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Rules</h1>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Rules marked “System” come from Sabine's whiteboard. They are absolute: the database refuses any attempt to edit, disable or delete them, and both the live quote and the server booking check enforce them.
      </p>
      <ConfigForm title="Crew & diet rules" fields={[
        { path: "crew_max_hours", label: "Crew max hours per event (ArbZG §4: 30-min break after 6 h)", type: "number" },
        { path: "second_crew_enabled", label: "Allow longer events with a relief crew shift", type: "bool" },
        { path: "second_crew_fee_per_truck", label: "Second crew fee per vehicle (€ net)", type: "number" },
        { path: "relief_crews_per_day", label: "Relief crews available per day", type: "number" },
        { path: "lock_days", label: "Lock bookings this many days before the event", type: "number" },
        { path: "vegan_threshold_pct", label: "Vegan share that requires a vegan truck (%)", type: "number" },
      ]} />
      <CrudTable
        table="pair_rules" title="Pair & group rules" order="rule_type" lockedKey="is_system" defaults={{ rule_type: "never_same_day", truck_ids: [], description: "", active: true }}
        cols={[
          { key: "rule_type", label: "Rule", type: "select", options: RULE_TYPES },
          { key: "truck_ids", label: "Trucks", type: "trucks" },
          { key: "description", label: "Explanation shown to planners", type: "text" },
          { key: "active", label: "Active", type: "bool" },
        ]}
      />
    </div>
  ),
});
