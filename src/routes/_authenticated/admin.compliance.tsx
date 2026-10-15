import { createFileRoute } from "@tanstack/react-router";
import { CrudTable } from "@/components/admin/CrudTable";
import { todayISO } from "@/lib/data";

function expiryBadge(d: string | null) {
  if (!d) return <span className="text-muted-foreground">no expiry</span>;
  const today = todayISO();
  const in60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const label = d.split("-").reverse().join(".");
  const cls = d < today ? "bg-destructive/15 text-destructive" : d <= in60 ? "bg-warning/25 text-warning-foreground dark:text-warning" : "bg-success/15 text-success";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{d < today ? "Expired " : d <= in60 ? "Expires " : ""}{label}</span>;
}

export const Route = createFileRoute("/_authenticated/admin/compliance")({
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Compliance documents</h1>
      <p className="text-sm text-muted-foreground">Required company documents that are expired on an event date block the booking. An expired TÜV removes that truck from assignment.</p>
      <CrudTable
        table="compliance_docs" title="Documents" order="doc_type" defaults={{ doc_type: "other", required: true, notes: "" }}
        cols={[
          { key: "doc_type", label: "Type", type: "select", options: [
            { value: "reisegewerbekarte", label: "Reisegewerbekarte (§55 GewO)" },
            { value: "food_registration", label: "Lebensmittelüberwachung registration" },
            { value: "ifsg_belehrung", label: "§43 IfSG Belehrung" },
            { value: "tuev", label: "TÜV inspection" },
            { value: "liability_insurance", label: "Liability insurance" },
            { value: "other", label: "Other" },
          ] },
          { key: "label", label: "Label", type: "text" },
          { key: "truck_id", label: "Truck", type: "truck" },
          { key: "crew_member", label: "Crew member", type: "text" },
          { key: "expires_on", label: "Expires", type: "date", render: (r) => expiryBadge(r.expires_on) },
          { key: "required", label: "Required", type: "bool" },
          { key: "notes", label: "Notes", type: "text", hideInTable: true },
        ]}
      />
    </div>
  ),
});
