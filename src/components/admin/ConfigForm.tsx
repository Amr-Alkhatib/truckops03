import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useReplan } from "@/hooks/use-replan";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/Field";

export interface CfgField {
  path: string; // dot path into config
  label: string;
  type: "number" | "text" | "bool" | "select" | "time";
  options?: { value: string; label: string }[];
}

const get = (o: any, p: string) => p.split(".").reduce((a, k) => a?.[k], o);
const setIn = (o: any, p: string, v: any) => {
  const keys = p.split(".");
  const copy = structuredClone(o);
  let cur = copy;
  keys.slice(0, -1).forEach((k) => (cur = cur[k] ??= {}));
  cur[keys.at(-1)!] = v;
  return copy;
};

export function useConfig() {
  return useQuery({ queryKey: ["admin-config"], queryFn: async () => (await supabase.from("app_config").select("config").eq("id", 1).single()).data!.config as any });
}

export async function saveConfig(cfg: any, qc: ReturnType<typeof useQueryClient>) {
  const { error } = await supabase.from("app_config").update({ config: cfg, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) { toast.error(error.message.includes("row") ? "Only admins can change pricing & rules" : error.message); return false; }
  toast.success("Saved — new quotes use this immediately");
  qc.invalidateQueries({ queryKey: ["admin-config"] });
  qc.invalidateQueries({ queryKey: ["engine-static"] });
  qc.invalidateQueries({ queryKey: ["public-config"] });
  return true;
}

export function ConfigForm({ title, fields, children }: { title: string; fields: CfgField[]; children?: (cfg: any, set: (c: any) => void) => React.ReactNode }) {
  const qc = useQueryClient();
  const replan = useReplan();
  const q = useConfig();
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => { if (q.data) setCfg(q.data); }, [q.data]);
  if (!cfg) return <Skeleton className="h-48 rounded-3xl" />;
  return (
    <div className="glass rounded-3xl p-4 sm:p-6">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.path} label={f.label}>
            {f.type === "bool" ? (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!get(cfg, f.path)} onChange={(e) => setCfg(setIn(cfg, f.path, e.target.checked))} /> Enabled</label>
            ) : f.type === "select" ? (
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={get(cfg, f.path)} onChange={(e) => setCfg(setIn(cfg, f.path, e.target.value))}>
                {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <Input type={f.type} step="any" value={get(cfg, f.path) ?? ""} onChange={(e) => setCfg(setIn(cfg, f.path, f.type === "number" ? Number(e.target.value) : e.target.value))} />
            )}
          </Field>
        ))}
      </div>
      {children?.(cfg, setCfg)}
      <Button variant="hero" className="mt-6" onClick={async () => { if (await saveConfig(cfg, qc)) replan(`${title} changed`); }}>Save</Button>
    </div>
  );
}
