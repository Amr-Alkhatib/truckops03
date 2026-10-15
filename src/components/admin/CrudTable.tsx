import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { DateInputDE } from "@/components/DateInputDE";
import { useReplan } from "@/hooks/use-replan";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/Field";

export type ColType = "text" | "number" | "bool" | "select" | "date" | "time" | "trucks" | "truck" | "tags";
export interface Col {
  key: string;
  label: string;
  type: ColType;
  options?: { value: string; label: string }[];
  nullable?: boolean;
  render?: (row: any) => ReactNode;
  hideInTable?: boolean;
}

export function useTrucks() {
  return useQuery({ queryKey: ["trucks-admin"], queryFn: async () => (await supabase.from("trucks").select("*").order("name")).data ?? [] });
}

export function CrudTable({ table, cols, title, order = "id", defaults = {}, allowDelete = true, filter, lockedKey, replan = true, allowAdd = true }: {
  table: string; cols: Col[]; title: string; order?: string; defaults?: Record<string, any>; allowDelete?: boolean; filter?: (q: any) => any;
  /** rows where this column is true are locked (shown with a lock, no edit/delete) */
  lockedKey?: string;
  /** re-run the truck planner for future dates after a change */
  replan?: boolean;
  allowAdd?: boolean;
}) {
  const runReplan = useReplan();
  const qc = useQueryClient();
  const trucks = useTrucks();
  const tName = (id: string) => trucks.data?.find((t) => t.id === id)?.name ?? "—";
  const q = useQuery({
    queryKey: ["crud", table],
    queryFn: async () => {
      let qq: any = (supabase.from(table as any) as any).select("*").order(order);
      if (filter) qq = filter(qq);
      const { data, error } = await qq;
      if (error) throw error;
      return data as any[];
    },
  });
  const [edit, setEdit] = useState<any | null>(null);

  const save = async () => {
    const row: any = {};
    for (const c of cols) {
      let v = edit[c.key];
      if (c.type === "number") v = v === "" || v == null ? (c.nullable ? null : 0) : Number(v);
      if ((c.type === "date" || c.type === "time" || c.type === "truck") && v === "") v = null;
      if (c.type === "select" && c.nullable && v === "") v = null;
      if (c.type === "tags") v = (Array.isArray(v) ? v : String(v ?? "").split(",")).map((x: string) => x.trim()).filter(Boolean);
      row[c.key] = v;
    }
    const res = edit.id ? await (supabase.from(table as any) as any).update(row).eq("id", edit.id) : await (supabase.from(table as any) as any).insert(row);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved — quotes use this immediately");
    qc.invalidateQueries({ queryKey: ["crud", table] });
    qc.invalidateQueries({ queryKey: ["engine-static"] });
    qc.invalidateQueries({ queryKey: ["trucks-admin"] });
    setEdit(null);
    if (replan) runReplan(`${title} changed`);
  };
  const del = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await (supabase.from(table as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["crud", table] });
    qc.invalidateQueries({ queryKey: ["engine-static"] });
    if (replan) runReplan(`${title} entry deleted`);
  };

  const display = (c: Col, r: any) => {
    if (c.render) return c.render(r);
    const v = r[c.key];
    if (c.type === "bool") return v ? "✓" : "—";
    if (c.type === "tags") return (v ?? []).join(", ") || "—";
    if (c.type === "trucks") return (v ?? []).map(tName).join(", ");
    if (c.type === "truck") return v ? tName(v) : "—";
    if (c.type === "select") return c.options?.find((o) => o.value === v)?.label ?? v ?? "—";
    if (c.type === "date" && v) return v.split("-").reverse().join(".");
    return v ?? "—";
  };

  return (
    <div className="glass rounded-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        {allowAdd && <Button variant="hero" size="sm" onClick={() => setEdit({ ...defaults })}><Plus /> Add</Button>}
      </div>
      {q.isLoading ? <Skeleton className="h-40" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              {cols.filter((c) => !c.hideInTable).map((c) => <th key={c.key} className="px-2 py-2 font-medium">{c.label}</th>)}<th />
            </tr></thead>
            <tbody>
              {q.data!.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                  {cols.filter((c) => !c.hideInTable).map((c) => <td key={c.key} className="px-2 py-2 align-top">{display(c, r)}</td>)}
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {lockedKey && r[lockedKey] ? (
                      <span title="Locked system rule — cannot be edited, disabled or deleted" className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"><Lock className="size-3" /> System</span>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => setEdit({ ...r })}><Pencil /></Button>
                        {allowDelete && <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 /></Button>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit" : "Add"} · {title}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-4 sm:grid-cols-2">
              {cols.map((c) => (
                <Field key={c.key} label={c.label}>
                  {c.type === "bool" ? (
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!edit[c.key]} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.checked })} /> {c.label}</label>
                  ) : c.type === "select" ? (
                    <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={edit[c.key] ?? ""} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })}>
                      {c.nullable && <option value="">—</option>}
                      {c.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : c.type === "truck" ? (
                    <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={edit[c.key] ?? ""} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })}>
                      <option value="">— none (company-wide)</option>
                      {trucks.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : c.type === "trucks" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {trucks.data?.map((t) => {
                        const sel: string[] = edit[c.key] ?? [];
                        const on = sel.includes(t.id);
                        return <button key={t.id} type="button" onClick={() => setEdit({ ...edit, [c.key]: on ? sel.filter((x) => x !== t.id) : [...sel, t.id] })} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary/10 text-primary" : ""}`}>{t.name}</button>;
                      })}
                    </div>
                  ) : c.type === "tags" ? (
                    <Input placeholder="Comma-separated" value={Array.isArray(edit[c.key]) ? edit[c.key].join(", ") : edit[c.key] ?? ""} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })} />
                  ) : c.type === "date" ? (
                    <DateInputDE value={edit[c.key]} onChange={(v) => setEdit({ ...edit, [c.key]: v })} />
                  ) : (
                    <Input type={c.type === "number" ? "number" : c.type} step="any" value={edit[c.key] ?? ""} onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })} />
                  )}
                </Field>
              ))}
            </div>
          )}
          <Button variant="hero" onClick={save}>Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
