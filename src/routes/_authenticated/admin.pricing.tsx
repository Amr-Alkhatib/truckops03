import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { ConfigForm } from "@/components/admin/ConfigForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LINE_KEYS = ["food", "crew", "travel", "generator", "espresso"];

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  component: () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Pricing</h1>
      <p className="text-sm text-muted-foreground">All prices are NET euros. VAT is added per category on the quote.</p>
      <ConfigForm
        title="Prices, VAT & approval"
        fields={[
          { path: "per_guest_price", label: "Food price per guest (€)", type: "number" },
          { path: "min_spend_per_truck", label: "Minimum spend per food truck (€)", type: "number" },
          { path: "weekend_surcharge_pct", label: "Weekend surcharge (%)", type: "number" },
          { path: "generator_fee", label: "Generator fee (€)", type: "number" },
          { path: "espresso_price", label: "Espresso Express flat price (€)", type: "number" },
          { path: "max_distance_km", label: "Max travel distance (km)", type: "number" },
          { path: "vat.food", label: "VAT food (%)", type: "number" },
          { path: "vat.beverage", label: "VAT beverages incl. coffee (%)", type: "number" },
          { path: "vat.services", label: "VAT travel / generator / crew / fees (%)", type: "number" },
          { path: "vat.permit", label: "VAT permit pass-through (%)", type: "number" },
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
    </div>
  ),
});
