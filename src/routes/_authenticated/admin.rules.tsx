import { createFileRoute } from "@tanstack/react-router";
import { CrudTable } from "@/components/admin/CrudTable";
import { ConfigForm } from "@/components/admin/ConfigForm";

export const Route = createFileRoute("/_authenticated/admin/rules")({
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Rules</h1>
      <ConfigForm title="Crew & diet rules" fields={[
        { path: "crew_max_hours", label: "Crew max hours per event", type: "number" },
        { path: "second_crew_enabled", label: "Allow longer events with a second crew shift", type: "bool" },
        { path: "second_crew_fee_per_truck", label: "Second crew fee per vehicle (€ net)", type: "number" },
        { path: "vegan_threshold_pct", label: "Vegan share that requires a vegan truck (%)", type: "number" },
      ]} />
      <CrudTable
        table="pair_rules" title="Pair & group rules" order="rule_type" defaults={{ rule_type: "never_same_day", truck_ids: [], description: "", active: true }}
        cols={[
          { key: "rule_type", label: "Rule", type: "select", options: [
            { value: "never_same_day", label: "Never out on the same day" },
            { value: "never_same_event", label: "Never at the same event" },
            { value: "max_one_of_group_on_weekend_day", label: "Max one per Sat/Sun" },
            { value: "allowed_together", label: "Allowed together" },
          ] },
          { key: "truck_ids", label: "Trucks", type: "trucks" },
          { key: "description", label: "Explanation shown to planners", type: "text" },
          { key: "active", label: "Active", type: "bool" },
        ]}
      />
    </div>
  ),
});
