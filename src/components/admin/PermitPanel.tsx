import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/Field";
import { DateInputDE } from "@/components/DateInputDE";
import { eur, formatDateDE } from "@/lib/engine";

/** Staff: record the permit, confirm route clearance, set the Stuttgart street group. */
export function PermitPanel({ b }: { b: any }) {
  const qc = useQueryClient();
  const [num, setNum] = useState("");
  const [fee, setFee] = useState("");
  const [issued, setIssued] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["booking", b.id] }); qc.invalidateQueries({ queryKey: ["admin-kpis"] }); };
  const needsPermit = b.permit_status !== "not_required";
  const needsRoute = b.route_clearance_status !== "not_needed";
  if (!needsPermit && !needsRoute && b.venue_type !== "public_ground") return null;

  const record = async () => {
    setBusy(true);
    let path: string | null = null;
    if (file) {
      path = `${b.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("permits").upload(path, file);
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
    }
    const { data, error } = await supabase.rpc("record_permit", { _id: b.id, _number: num, _fee: fee === "" ? null : Number(fee.replace(",", ".")), _issued: issued || null, _file: path } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(data === "confirmed" ? "Permit recorded — booking confirmed" : "Permit recorded");
    refresh();
  };
  const confirmRoute = async () => {
    const note = prompt("How was the route clearance checked? (e.g. driven/checked bridges on the route)") ?? "";
    if (!note.trim()) return;
    const { data, error } = await supabase.rpc("confirm_route_clearance", { _id: b.id, _note: note });
    if (error) return toast.error(error.message);
    toast.success(data === "confirmed" ? "Route confirmed — booking confirmed" : "Route clearance confirmed");
    refresh();
  };
  const setGroup = async (g: string) => {
    const { error } = await supabase.rpc("set_street_group", { _id: b.id, _group: g });
    if (error) return toast.error(error.message);
    toast.success(`Street group ${g} saved`);
    refresh();
  };
  const openFile = async () => {
    const { data, error } = await supabase.storage.from("permits").createSignedUrl(b.permit_file_path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4 rounded-2xl border p-4">
      <h2 className="font-semibold">Permit & route (staff)</h2>
      {b.permit_reasons?.length > 0 && <ul className="list-disc pl-5 text-sm text-muted-foreground">{b.permit_reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>}
      {b.venue_type === "public_ground" && /stuttgart/i.test(b.town) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Stuttgart street group: {["1", "2", "3", "S"].map((g) => <Button key={g} size="sm" variant={b.street_group === g ? "secondary" : "outline"} onClick={() => setGroup(g)}>{g}</Button>)}
          <span className="text-xs text-muted-foreground">{b.street_group ? "" : "Not set — quote uses group S (max. estimate)."}</span>
        </div>
      )}
      {needsPermit && (b.permit_status === "issued" ? (
        <p className="text-sm">✓ Permit <strong>{b.permit_number}</strong> issued {formatDateDE(b.permit_issued_on)}{b.permit_fee != null && ` · fee ${eur(Number(b.permit_fee))}`} {b.permit_file_path && <button className="text-primary underline" onClick={openFile}>open file</button>}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Permit number"><Input value={num} onChange={(e) => setNum(e.target.value)} /></Field>
          <Field label="Fee (€, per Gebührenbescheid)"><Input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
          <Field label="Issued on"><DateInputDE value={issued} onChange={setIssued} /></Field>
          <Field label="Upload permit (PDF/image)"><Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <Button variant="hero" size="sm" disabled={busy || !num || !issued} onClick={record}>Record permit</Button>
        </div>
      ))}
      {needsRoute && (
        <div className="text-sm">
          <p>Route clearance (Wurst Case Scenario, 3.6 m): <strong>{b.route_clearance_status.replace("_", " ")}</strong>{b.route_clearance_note && ` — ${b.route_clearance_note}`}</p>
          {b.route_clearance_status === "unverified" && <Button size="sm" variant="outline" className="mt-2" onClick={confirmRoute}>Confirm route clearance</Button>}
        </div>
      )}
    </div>
  );
}
