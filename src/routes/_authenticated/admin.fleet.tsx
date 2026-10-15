import { createFileRoute } from "@tanstack/react-router";
import { CrudTable } from "@/components/admin/CrudTable";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const Route = createFileRoute("/_authenticated/admin/fleet")({
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Fleet</h1>
      <CrudTable
        table="trucks" title="Trucks" order="name" allowDelete={false}
        defaults={{ max_guests: 100, height_m: 3, footprint_m2: 18, status: "active", vegan: false, gluten_free: false, halal: false, needs_400v: false, is_addon: false }}
        cols={[
          { key: "name", label: "Name", type: "text" },
          { key: "cuisine", label: "Cuisine", type: "text" },
          { key: "max_guests", label: "Max guests", type: "number" },
          { key: "vegan", label: "Vegan", type: "bool" },
          { key: "gluten_free", label: "Gluten-free", type: "bool" },
          { key: "halal", label: "Halal", type: "bool" },
          { key: "height_m", label: "Height m", type: "number" },
          { key: "footprint_m2", label: "Footprint m²", type: "number" },
          { key: "needs_400v", label: "Needs 400V", type: "bool" },
          { key: "is_addon", label: "Add-on only", type: "bool" },
          { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "retired", label: "Retired (never bookable)" }] },
        ]}
      />
      <CrudTable
        table="truck_blackouts" title="Blackout periods" order="truck_id" defaults={{ reason: "" }}
        cols={[
          { key: "truck_id", label: "Truck", type: "truck" },
          { key: "start_date", label: "From", type: "date" },
          { key: "end_date", label: "To", type: "date" },
          { key: "recurring_month", label: "Every year in", type: "select", nullable: true, options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })), render: (r) => (r.recurring_month ? `Every ${MONTHS[r.recurring_month - 1]}` : "—") },
          { key: "reason", label: "Reason", type: "text" },
        ]}
      />
    </div>
  ),
});
