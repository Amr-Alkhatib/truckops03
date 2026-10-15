import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, STATUS_LABELS } from "@/components/StatusBadge";
import { QuoteSummary } from "@/components/QuoteSummary";
import { eur, formatDateDE, type Quote } from "@/lib/engine";
import { downloadQuotePdf } from "@/lib/pdf";
import { useAuth } from "@/hooks/use-auth";
import { useReplan } from "@/hooks/use-replan";
import { PermitPanel } from "@/components/admin/PermitPanel";

export function BookingDetail({ id }: { id: string }) {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const replan = useReplan();
  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const [b, a] = await Promise.all([
        supabase.from("bookings").select("*").eq("id", id).single(),
        supabase.from("booking_audit").select("*").eq("booking_id", id).order("created_at"),
      ]);
      if (b.error) throw b.error;
      return { b: b.data, audit: a.data ?? [] };
    },
  });

  const setStatus = async (status: string) => {
    const note = status === "cancelled" ? prompt("Reason for cancelling (optional)") ?? "" : "";
    const { error } = await supabase.rpc("set_booking_status", { _id: id, _status: status as any, _note: note });
    if (error) return toast.error(error.message);
    toast.success(`Status: ${STATUS_LABELS[status]}`);
    replan(`booking ${STATUS_LABELS[status].toLowerCase()}`, [q.data!.b.event_date]);
    qc.invalidateQueries({ queryKey: ["booking", id] });
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
  };

  if (q.isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  if (!q.data) return <p>Booking not found.</p>;
  const { b, audit } = q.data;
  const quote = b.quote as unknown as Quote;
  const link = b.approval_token ? `${window.location.origin}/approve/${b.approval_token}` : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="glass space-y-6 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{b.ref}</p>
            <h1 className="text-3xl font-semibold">{b.venue_name}</h1>
            <p className="text-muted-foreground">{formatDateDE(b.event_date)} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)} · {b.guests} guests</p>
          </div>
          <StatusBadge status={b.status} />
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ["Address", `${b.address} (${b.town})`],
            ["Venue", `${b.venue_type === "public_ground" ? "Public ground" : "Private campus"} · ${b.has_400v ? "400V" : "no 400V"} · ${b.clearance_m ?? "no"} m clearance · ${b.space_m2} m²`],
            ["Diet", `vegan ${b.vegan} · gluten-free ${b.gluten_free} · halal ${b.halal}`],
            ["Company", `${b.company_name} · PO ${b.po_number}`],
            ["Billing", b.billing_address],
            ["Contact", `${b.contact_name} · ${b.contact_mobile}`],
            ["Flags", `${b.sales_to_public ? "sales to public without order" : "pre-ordered catering"} · ${b.alcohol_served ? "alcohol served" : "no alcohol"}`],
            ["Road distance", `${Number(b.distance_km).toFixed(1)} km · ${b.distance_method} · ${new Date(b.distance_computed_at).toLocaleString("de-DE")}`],
            ...(b.approver_name ? [["Client approver", `${b.approver_name} (${b.approver_email})`]] : []),
            ...(b.client_response_reason ? [["Client comment", b.client_response_reason]] : []),
          ].map(([k, v]) => (
            <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
        {b.status === "conflict" && b.conflict_reason && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><strong>Conflict:</strong> {b.conflict_reason}</p>
        )}
        {isStaff && <PermitPanel b={b} />}
        {link && b.status === "awaiting_approval" && (
          <div className="flex gap-2">
            <Input readOnly value={link} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(link); toast.success("Approval link copied"); }}><Copy /></Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {isStaff
            ? (["confirmed", "cancelled", "completed"] as const).filter((s) => s !== b.status).map((s) => (
                <Button key={s} variant={s === "cancelled" ? "outline" : "secondary"} size="sm" onClick={() => setStatus(s)}>Mark {STATUS_LABELS[s].toLowerCase()}</Button>
              ))
            : ["awaiting_approval", "confirmed"].includes(b.status) && <Button variant="outline" size="sm" onClick={() => setStatus("cancelled")}>Cancel booking</Button>}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">History</h2>
          <ol className="space-y-2 border-l pl-4 text-sm">
            {audit.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.from_status ? `${STATUS_LABELS[a.from_status]} → ` : ""}{STATUS_LABELS[a.to_status]}</span>
                <span className="text-muted-foreground"> · {a.actor} · {new Date(a.created_at).toLocaleString("de-DE")}</span>
                {a.note && <p className="text-muted-foreground">“{a.note}”</p>}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="glass rounded-3xl p-6">
          <h2 className="mb-4 text-xl font-semibold">Quote · {eur(Number(b.total_gross))}</h2>
          <QuoteSummary quote={quote} />
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => downloadQuotePdf(b as any, quote)}><Download /> Download PDF</Button>
        </div>
      </aside>
    </div>
  );
}
