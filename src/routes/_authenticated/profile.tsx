import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { MapPin, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, YesNo } from "@/components/Field";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile & places — TruckOps" }, { name: "description", content: "Your details and saved event places." }] }),
  component: Profile,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()/-]{6,20}$/, "Enter a valid phone number"),
  company_name: z.string().trim().min(1, "Company is required").max(200),
  billing_address: z.string().trim().min(1, "Billing address is required").max(400),
});

const presetSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(80),
  venue_name: z.string().trim().min(1, "Venue name is required").max(200),
  address: z.string().trim().min(1, "Address is required"),
  lat: z.number({ message: "Pick an address from the suggestions" }),
  lon: z.number(),
  town: z.string(),
  venue_type: z.enum(["public_ground", "private_campus"], { message: "Choose a venue type" }),
  has_400v: z.boolean({ message: "Required" }),
  clearance_m: z.number().min(2).max(20).nullable(),
  space_m2: z.number({ message: "Required" }).positive(),
  start_time: z.string().regex(/^\d{2}:\d{2}/, "Required"),
  end_time: z.string().regex(/^\d{2}:\d{2}/, "Required"),
  guests: z.number({ message: "Required" }).int().min(1),
  vegan: z.number().int().min(0),
  gluten_free: z.number().int().min(0),
  halal: z.number().int().min(0),
  notes: z.string().max(1000),
});

function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pq = useQuery({ queryKey: ["my-profile"], enabled: !!user, queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data });
  const presets = useQuery({ queryKey: ["presets"], queryFn: async () => (await supabase.from("event_presets").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [], enabled: !!user });
  const [p, setP] = useState({ full_name: "", phone: "", company_name: "", billing_address: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => { if (pq.data) setP({ full_name: pq.data.full_name, phone: pq.data.phone, company_name: pq.data.company_name, billing_address: pq.data.billing_address }); }, [pq.data]);

  const save = async () => {
    const r = profileSchema.safeParse(p);
    if (!r.success) return setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
    setErrs({});
    const { error } = await supabase.from("profiles").update({ ...r.data, updated_at: new Date().toISOString() }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this place?")) return;
    await supabase.from("event_presets").delete().eq("id", id);
    toast.success("Place deleted");
    qc.invalidateQueries({ queryKey: ["presets"] });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
      <section className="glass rounded-3xl p-6 sm:p-8">
        <h1 className="text-3xl font-semibold">Your profile</h1>
        <p className="mb-6 text-sm text-muted-foreground">Used as defaults for every booking.</p>
        {pq.isLoading ? <Skeleton className="h-48" /> : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errs.full_name}><Input value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></Field>
            <Field label="Phone" error={errs.phone}><Input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
            <Field label="Company name" error={errs.company_name}><Input value={p.company_name} onChange={(e) => setP({ ...p, company_name: e.target.value })} /></Field>
            <Field label="Default billing address" error={errs.billing_address}><Textarea value={p.billing_address} onChange={(e) => setP({ ...p, billing_address: e.target.value })} /></Field>
            <div><Button variant="hero" onClick={save}>Save profile</Button></div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">My places</h2>
          <Button variant="hero" onClick={() => setEditing({})}><Plus /> Add place</Button>
        </div>
        {presets.isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div> : presets.data?.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-muted-foreground">Save your regular venues — like saved addresses in a delivery app — and book them in one click.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {presets.data!.map((x, i) => (
              <motion.div key={x.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass flex flex-col rounded-2xl p-5">
                <p className="text-lg font-semibold">{x.label}</p>
                <p className="flex gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" /><span className="line-clamp-2">{x.venue_name} · {x.address}</span></p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-accent px-2 py-0.5">{x.venue_type === "public_ground" ? "Public ground" : "Private campus"}</span>
                  {x.has_400v && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5"><Zap className="size-3" />400V</span>}
                  <span className="rounded-full bg-accent px-2 py-0.5">{x.guests} guests</span>
                  <span className="rounded-full bg-accent px-2 py-0.5">{x.start_time.slice(0, 5)}–{x.end_time.slice(0, 5)}</span>
                </div>
                <div className="mt-auto flex gap-2 pt-4">
                  <Button size="sm" variant="outline" onClick={() => setEditing(x)}><Pencil /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => del(x.id)}><Trash2 /></Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
      {editing && <PresetDialog preset={editing} userId={user!.id} onClose={() => setEditing(null)} />}
    </main>
  );
}

function PresetDialog({ preset, userId, onClose }: { preset: any; userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>({
    label: preset.label ?? "", venue_name: preset.venue_name ?? "", address: preset.address ?? "", lat: preset.lat ?? null, lon: preset.lon ?? null, town: preset.town ?? "",
    venue_type: preset.venue_type ?? "", has_400v: preset.has_400v ?? null, noLimit: preset.id ? preset.clearance_m == null : false, clearance_m: preset.clearance_m ?? "",
    space_m2: preset.space_m2 ?? "", start_time: preset.start_time?.slice(0, 5) ?? "", end_time: preset.end_time?.slice(0, 5) ?? "",
    guests: preset.guests ?? "", vegan: preset.vegan ?? 0, gluten_free: preset.gluten_free ?? 0, halal: preset.halal ?? 0, notes: preset.notes ?? "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const n = (v: any) => (v === "" || v == null ? undefined : Number(v));

  const save = async () => {
    const payload = {
      ...f, venue_type: f.venue_type || undefined, has_400v: f.has_400v ?? undefined, lat: f.lat ?? undefined, lon: f.lon ?? undefined,
      clearance_m: f.noLimit ? null : n(f.clearance_m) ?? undefined, space_m2: n(f.space_m2), guests: n(f.guests), vegan: n(f.vegan) ?? 0, gluten_free: n(f.gluten_free) ?? 0, halal: n(f.halal) ?? 0,
    };
    delete payload.noLimit;
    const r = presetSchema.safeParse(payload);
    if (!r.success) return setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message.startsWith("Expected") ? "Required" : i.message])));
    const q = preset.id ? supabase.from("event_presets").update(r.data).eq("id", preset.id) : supabase.from("event_presets").insert({ ...r.data, user_id: userId });
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Place saved");
    qc.invalidateQueries({ queryKey: ["presets"] });
    onClose();
  };
  const s = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{preset.id ? "Edit place" : "New place"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label" error={errs.label}><Input value={f.label} onChange={s("label")} placeholder="HQ summer party" /></Field>
          <Field label="Venue name" error={errs.venue_name}><Input value={f.venue_name} onChange={s("venue_name")} /></Field>
          <div className="sm:col-span-2"><Field label="Address" error={errs.address || errs.lat}><AddressAutocomplete value={f.address} onType={(v) => setF({ ...f, address: v, lat: null, lon: null })} onSelect={(r) => setF({ ...f, address: r.label, lat: r.lat, lon: r.lon, town: r.town })} /></Field></div>
          <Field label="Venue type" error={errs.venue_type}>
            <div className="grid grid-cols-2 gap-2">{([["public_ground", "Public"], ["private_campus", "Private campus"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setF({ ...f, venue_type: v })} className={`rounded-xl border px-3 py-2 text-sm ${f.venue_type === v ? "border-primary bg-primary/10 text-primary" : ""}`}>{l}</button>))}</div>
          </Field>
          <Field label="400V available" error={errs.has_400v}><YesNo value={f.has_400v} onChange={(v) => setF({ ...f, has_400v: v })} /></Field>
          <Field label="Clearance (m)" error={errs.clearance_m}>
            <Input disabled={f.noLimit} value={f.clearance_m} onChange={s("clearance_m")} />
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.noLimit} onChange={(e) => setF({ ...f, noLimit: e.target.checked })} /> No height limit</label>
          </Field>
          <Field label="Space (m²)" error={errs.space_m2}><Input value={f.space_m2} onChange={s("space_m2")} /></Field>
          <Field label="Default start" error={errs.start_time}><Input type="time" value={f.start_time} onChange={s("start_time")} /></Field>
          <Field label="Default end" error={errs.end_time}><Input type="time" value={f.end_time} onChange={s("end_time")} /></Field>
          <Field label="Typical guests" error={errs.guests}><Input value={f.guests} onChange={s("guests")} /></Field>
          <Field label="Vegan" error={errs.vegan}><Input value={f.vegan} onChange={s("vegan")} /></Field>
          <Field label="Gluten-free" error={errs.gluten_free}><Input value={f.gluten_free} onChange={s("gluten_free")} /></Field>
          <Field label="Halal" error={errs.halal}><Input value={f.halal} onChange={s("halal")} /></Field>
          <div className="sm:col-span-2"><Field label="Special notes"><Textarea value={f.notes} onChange={s("notes")} /></Field></div>
        </div>
        <Button variant="hero" onClick={save}>Save place</Button>
      </DialogContent>
    </Dialog>
  );
}
