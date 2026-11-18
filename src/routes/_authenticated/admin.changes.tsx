import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/changes")({
  head: () => ({ meta: [{ title: "Change log — TruckOps back office" }, { name: "description", content: "Every back-office edit." }] }),
  component: Changes,
});

const LABEL: Record<string, string> = {
  app_config: "Settings", trucks: "Fleet", truck_blackouts: "Blackouts", pair_rules: "Rules", towns: "Towns", town_checklist: "Town checklist",
  vat_rates: "VAT rates", compliance_docs: "Compliance", crews: "Crews", truck_crew: "Truck crews", user_roles: "User roles", packages: "Packages", planner_links: "Booking links",
};
const SKIP = new Set(["created_at", "updated_at"]);

function diff(o: any, n: any) {
  if (!o) return Object.entries(n ?? {}).filter(([k]) => !SKIP.has(k) && k !== "id" && k !== "token").map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  if (!n) return ["deleted"];
  return Object.keys(n).filter((k) => !SKIP.has(k) && k !== "token" && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => `${k}: ${JSON.stringify(o[k])} → ${JSON.stringify(n[k])}`);
}

function Changes() {
  const { t } = useI18n();
  const [table, setTable] = useState("");
  const q = useQuery({
    queryKey: ["change-log", table],
    queryFn: async () => {
      let r = supabase.from("admin_change_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (table) r = r.eq("table_name", table);
      return (await r).data ?? [];
    },
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("Change log")}</h1>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="">{t("All areas")}</option>
          {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </select>
      </div>
      <p className="text-sm text-muted-foreground">{t("Recorded automatically for every back-office edit. Cannot be changed or deleted.")}</p>
      {q.isLoading ? <Skeleton className="h-64 rounded-3xl" /> : (
        <div className="glass overflow-x-auto rounded-3xl p-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="py-2 pr-3">{t("When")}</th><th className="pr-3">{t("Who")}</th><th className="pr-3">{t("Area")}</th><th className="pr-3">{t("Action")}</th><th>{t("Change")}</th></tr></thead>
            <tbody>
              {(q.data ?? []).map((r) => (
                <tr key={r.id} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap py-2 pr-3">{new Date(r.created_at).toLocaleString("de-DE")}</td>
                  <td className="pr-3">{r.actor}</td>
                  <td className="pr-3">{t(LABEL[r.table_name] ?? r.table_name)}</td>
                  <td className="pr-3">{t(r.action)}</td>
                  <td className="max-w-xl break-words font-mono text-xs">{diff(r.old_data, r.new_data).slice(0, 8).join(" · ")}</td>
                </tr>
              ))}
              {!q.data?.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">{t("No changes recorded yet.")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
