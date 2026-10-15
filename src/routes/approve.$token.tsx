import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { QuoteSummary } from "@/components/QuoteSummary";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateDE, type Quote } from "@/lib/engine";

export const Route = createFileRoute("/approve/$token")({
  head: () => ({
    meta: [
      { title: "Approve catering quote — Rolling Feast" },
      { name: "description", content: "Review and approve a Rolling Feast catering quote." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Approve,
});

function Approve() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["approve", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booking_by_token", { _token: token });
      if (error) throw error;
      return data as any;
    },
  });

  const respond = async (accept: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("respond_to_approval", { _token: token, _accept: accept, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(accept ? "Quote accepted — thank you!" : "Quote rejected");
    qc.invalidateQueries({ queryKey: ["approve", token] });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {q.isLoading ? <Skeleton className="h-96 rounded-3xl" /> : !q.data ? (
          <div className="glass rounded-3xl p-10 text-center">This approval link is invalid or has expired.</div>
        ) : (
          <div className="glass space-y-6 rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Quote {q.data.ref} for {q.data.company_name} · PO {q.data.po_number}</p>
                <h1 className="text-3xl font-semibold">Hi {q.data.approver_name}, please approve</h1>
                <p className="text-muted-foreground">{q.data.contact_name} requested food-truck catering for {q.data.guests} guests on {formatDateDE(q.data.event_date)}, {q.data.start_time.slice(0, 5)}–{q.data.end_time.slice(0, 5)} at {q.data.venue_name}.</p>
              </div>
              <StatusBadge status={q.data.status} />
            </div>
            <QuoteSummary quote={q.data.quote as Quote} compact />
            {q.data.status === "awaiting_approval" ? (
              <div className="space-y-3">
                <Textarea placeholder="Optional comment or reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="hero" disabled={busy} onClick={() => respond(true)}><Check /> Accept quote</Button>
                  <Button variant="outline" disabled={busy} onClick={() => respond(false)}><X /> Reject</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This quote has been answered. {q.data.client_response_reason && `Comment: “${q.data.client_response_reason}”`}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
