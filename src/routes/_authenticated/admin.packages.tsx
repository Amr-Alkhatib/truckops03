import { createFileRoute } from "@tanstack/react-router";
import { CrudTable } from "@/components/admin/CrudTable";

export const Route = createFileRoute("/_authenticated/admin/packages")({
  head: () => ({ meta: [{ title: "Packages — TruckOps back office" }, { name: "description", content: "Bookable event packages." }] }),
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Packages</h1>
      <p className="text-sm text-muted-foreground">Packages appear as one-click choices in the booking form. Events longer than the crew limit get a second crew shift.</p>
      <CrudTable
        table="packages" title="Packages" order="sort" replan={false}
        defaults={{ slug: "", name: "", description: "", start_time: "12:00", end_time: "16:00", bestseller: false, active: true, sort: 10 }}
        cols={[
          { key: "name", label: "Name", type: "text" },
          { key: "slug", label: "Short code (link)", type: "text" },
          { key: "start_time", label: "Start", type: "time" },
          { key: "end_time", label: "End", type: "time" },
          { key: "description", label: "Description", type: "text", hideInTable: true },
          { key: "bestseller", label: "Best-seller", type: "bool" },
          { key: "active", label: "Bookable", type: "bool" },
          { key: "sort", label: "Order", type: "number" },
        ]}
      />
    </div>
  ),
});
