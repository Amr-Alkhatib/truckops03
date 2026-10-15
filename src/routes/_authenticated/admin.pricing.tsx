import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { ConfigForm } from "@/components/admin/ConfigForm";
import { CrudTable } from "@/components/admin/CrudTable";
import { formatDateDE } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LINE_KEYS = ["food", "crew", "travel", "generator", "espresso"];

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({ meta: [{ title: "Pricing & VAT — TruckOps back office" }, { name: "description", content: "Net prices, VAT rates by date of service." }] }),
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Pricing</h1>
      <p className="text-sm text-muted-foreground">All prices are NET euros. VAT is added per category on the quote.</p>
      <ConfigForm
        title="Prices & approval"
        fields={[
          { path: "per_guest_price", label: "Food price per guest (€)", type: "number" },
          { path: "min_spend_per_truck", label: "Minimum spend per food truck (€)", type: "number" },
          { path: "weekend_surcharge_pct", label: "Weekend surcharge (%)", type: "number" },
          { path: "generator_fee", label: "Generator fee (€)", type: "number" },
          { path: "espresso_price", label: "Espresso Express flat price (€)", type: "number" },
          { path: "max_distance_km", label: "Max travel distance (km)", type: "number" },
          { path: "approval_threshold", label: "Client approval threshold (€)", type: "number" },
          { path: "approval_basis", label: "Threshold applies to", type: "select", options: [{ value: "net", label: "Net total" }, { value: "gross", label: "Gross total" }] },
          { path: "depot.label", label: "Depot label", type: "text" },
          { path: "depot.lat", label: "Depot latitude", type: "number" },
          { path: "depot.lon", label: "Depot longitude", type: "number" },
          { path: "afterwork_package.name", label: "Best-seller package name", type: "text" },
          { path: "afterwork_package.start", label: "Package start", type: "time" },
          { path: "afterwork_package.end", label: "Package end", type: "time" },
        ]}
      >
        {(cfg, set) => (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">Weekend surcharge applies to</h3>
              <div className="flex flex-wrap gap-2">
                {LINE_KEYS.map((k) => {
                  const on = cfg.weekend_applies_to.includes(k);
                  return <button key={k} type="button" onClick={() => set({ ...cfg, weekend_applies_to: on ? cfg.weekend_applies_to.filter((x: string) => x !== k) : [...cfg.weekend_applies_to, k] })} className={`rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary/10 text-primary" : ""}`}>{k}</button>;
                })}
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Travel zones (road km)</h3>
              {cfg.travel_zones.map((z: any, i: number) => (
                <div key={i} className="mb-2 flex items-center gap-2 text-sm">
                  up to <Input className="w-20" type="number" value={z.max_km} onChange={(e) => set({ ...cfg, travel_zones: cfg.travel_zones.map((x: any, j: number) => (j === i ? { ...x, max_km: Number(e.target.value) } : x)) })} /> km →
                  € <Input className="w-24" type="number" value={z.fee} onChange={(e) => set({ ...cfg, travel_zones: cfg.travel_zones.map((x: any, j: number) => (j === i ? { ...x, fee: Number(e.target.value) } : x)) })} />
                  <Button size="icon" variant="ghost" onClick={() => set({ ...cfg, travel_zones: cfg.travel_zones.filter((_: any, j: number) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => set({ ...cfg, travel_zones: [...cfg.travel_zones, { max_km: 50, fee: 150 }] })}><Plus /> Add zone</Button>
              <p className="mt-2 text-xs text-muted-foreground">Beyond the max travel distance, bookings are blocked.</p>
            </div>
          </div>
        )}
      </ConfigForm>
      <CrudTable
        table="vat_rates" title="VAT rates (by date of service)" order="valid_from" defaults={{ category: "food", rate: 0, valid_from: "", status: "unverified", label: "", legal_basis: "" }}
        cols={[
          { key: "category", label: "Category", type: "select", options: [{ value: "food", label: "Food / catering" }, { value: "beverage", label: "Beverages incl. coffee" }, { value: "services", label: "Travel, generator, crew, fees" }, { value: "permit", label: "Permit pass-through" }] },
          { key: "rate", label: "Rate %", type: "number" },
          { key: "valid_from", label: "Valid from", type: "date" },
          { key: "valid_to", label: "Valid to", type: "date", render: (r) => (r.valid_to ? formatDateDE(r.valid_to) : "open") },
          { key: "label", label: "Label", type: "text", hideInTable: true },
          { key: "legal_basis", label: "Legal basis", type: "text", hideInTable: true },
          { key: "source_url", label: "Source", type: "text", render: (r) => r.source_url ? <a className="text-primary underline" href={r.source_url} target="_blank" rel="noreferrer">{r.source_title || "link"}</a> : "—" },
          { key: "source_title", label: "Source title", type: "text", hideInTable: true },
          { key: "verified_on", label: "Checked on", type: "date" },
          { key: "status", label: "Status", type: "select", options: [{ value: "verified", label: "verified" }, { value: "unverified", label: "unverified" }] },
        ]}
      />
      <p className="text-xs text-muted-foreground">The rate is chosen by the EVENT date (date of service), not the booking date. Enter future changes in advance with a new “valid from”.</p>
    </div>
  ),
});
