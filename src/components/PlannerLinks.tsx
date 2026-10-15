import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/Field";
import { DateInputDE } from "@/components/DateInputDE";
import { formatDateDE } from "@/lib/engine";

const token = () => {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};

/** Booking links: colleagues can book without an account; bookings appear under your account. */
export function PlannerLinks() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState("");
  const links = useQuery({ queryKey: ["planner-links"], queryFn: async () => (await supabase.from("planner_links").select("*").order("created_at", { ascending: false })).data ?? [] });
  const url = (t: string) => `${window.location.origin}/p/${t}`;

  const create = async () => {
    if (!label.trim()) return toast.error("Give the link a name, e.g. “Marketing team”");
    const { data: u } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("company_name, billing_address").eq("id", u.user!.id).single();
    const { error } = await supabase.from("planner_links").insert({
      token: token(), label: label.trim(), owner_id: u.user!.id, company_name: prof?.company_name ?? "", billing_address: prof?.billing_address ?? "", expires_on: expires || null,
    });
    if (error) return toast.error(error.message);
    setLabel(""); setExpires("");
    toast.success("Booking link created");
    qc.invalidateQueries({ queryKey: ["planner-links"] });
  };
  const toggle = async (id: string, active: boolean) => {
    await supabase.from("planner_links").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["planner-links"] });
  };

  return (
    <section className="glass rounded-3xl p-5 sm:p-8">
      <h2 className="flex items-center gap-2 text-2xl font-semibold"><Link2 className="size-5" /> Booking links</h2>
      <p className="mt-1 text-sm text-muted-foreground">Share a link so colleagues can book without an account. Bookings made through it appear in your bookings. Turn a link off at any time.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Field label="Name"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Marketing team" /></Field>
        <Field label="Valid until (optional)"><DateInputDE value={expires} onChange={setExpires} /></Field>
        <Button variant="hero" onClick={create}>Create link</Button>
      </div>
      <ul className="mt-4 space-y-2">
        {(links.data ?? []).map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
            <span className="font-medium">{l.label}</span>
            <span className="text-xs text-muted-foreground">{l.expires_on ? `until ${formatDateDE(l.expires_on)}` : "no expiry"}</span>
            {l.active ? (
              <>
                <Input readOnly value={url(l.token)} className="h-8 min-w-0 flex-1 font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(url(l.token)); toast.success("Link copied"); }}><Copy /></Button>
                <Button size="sm" variant="ghost" onClick={() => toggle(l.id, false)}>Turn off</Button>
              </>
            ) : (
              <><span className="flex-1 text-xs text-muted-foreground">turned off</span><Button size="sm" variant="ghost" onClick={() => toggle(l.id, true)}>Turn on</Button></>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
