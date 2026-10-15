import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bookingSchema } from "./booking-schema";
import { buildQuote, type Quote } from "./engine";
import { loadDateData, loadStatic, makeContext } from "./data";
import { roadDistance } from "./geo";

export type SubmitResult =
  | { ok: true; bookingId: string; ref: string; status: string; approvalToken: string | null; quote: Quote }
  | { ok: false; quote: Quote | null; error?: string; leadCreated?: boolean };

/** Authoritative booking submission: recomputes distance + quote on the server. */
export const submitBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    const sb = context.supabase;
    const s = await loadStatic(sb);
    const dd = await loadDateData(sb, data.event_date);
    let route;
    try {
      route = await roadDistance(s.config.depot, { lat: data.lat, lon: data.lon });
    } catch (e) {
      return { ok: false, quote: null, error: "We couldn't calculate the road distance right now. Please try again in a minute." };
    }
    const input = { ...data, distance_km: route.km };
    const quote = buildQuote(input, makeContext(s, dd));

    if (!quote.ok) {
      if (quote.needsReview) {
        await sb.from("leads").insert({ user_id: context.userId, reason: quote.blockers[0]?.message ?? "Needs review", town: data.town, payload: input as any });
        return { ok: false, quote, leadCreated: true };
      }
      return { ok: false, quote };
    }
    if (quote.needsApproval && (!data.approver_name || !data.approver_email))
      return { ok: false, quote, error: "This order needs a second approver at your company — please enter their name and email." };

    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = quote.needsApproval ? Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") : null;
    const truckIds = [...quote.trucks.map((t) => t.id), ...(quote.espressoTruckId ? [quote.espressoTruckId] : [])];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        user_id: context.userId,
        status: quote.needsApproval ? "awaiting_approval" : "confirmed",
        package: data.package,
        event_date: data.event_date,
        start_time: data.start_time,
        end_time: data.end_time,
        venue_name: data.venue_name,
        address: data.address,
        town: data.town,
        lat: data.lat,
        lon: data.lon,
        venue_type: data.venue_type,
        has_400v: data.has_400v,
        clearance_m: data.clearance_m,
        space_m2: data.space_m2,
        guests: data.guests,
        vegan: data.vegan,
        gluten_free: data.gluten_free,
        halal: data.halal,
        espresso: data.espresso,
        company_name: data.company_name,
        billing_address: data.billing_address,
        po_number: data.po_number,
        contact_name: data.contact_name,
        contact_mobile: data.contact_mobile,
        approver_name: quote.needsApproval ? data.approver_name : null,
        approver_email: quote.needsApproval ? data.approver_email : null,
        approval_token: token,
        truck_ids: truckIds,
        distance_km: route.km,
        distance_method: route.method,
        distance_computed_at: new Date().toISOString(),
        quote: quote as any,
        total_net: quote.totalNet,
        total_gross: quote.totalGross,
      })
      .select("id, ref, status")
      .single();
    if (error) {
      console.error(error);
      return { ok: false, quote, error: "Saving the booking failed. Please try again." };
    }
    return { ok: true, bookingId: row.id, ref: row.ref, status: row.status, approvalToken: token, quote };
  });
