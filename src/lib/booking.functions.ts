import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bookingSchema } from "./booking-schema";
import { buildQuote, findTown, type Quote } from "./engine";
import { hgvHeightRoute, roadDistance } from "./geo";
import { todayISO } from "./data";

export type SubmitResult =
  | { ok: true; bookingId: string; ref: string; status: string; approvalToken: string | null; quote: Quote; routeNote: string | null }
  | { ok: false; quote: Quote | null; error?: string; leadCreated?: boolean };

const hex = (n: number) => {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};

/** Authoritative booking submission: distance, quote and truck plan are recomputed server-side. */
export const submitBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data, context }): Promise<SubmitResult> =>
    doSubmit(data, context.userId, (context.claims as any)?.email ?? "planner", null));

/** Planner token link (no account): the booking is owned by the link's creator. */
export const submitBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128), booking: bookingSchema }).parse(d))
  .handler(async ({ data }): Promise<SubmitResult> => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await admin.from("planner_links").select("id, owner_id, label, active, expires_on").eq("token", data.token).maybeSingle();
    if (!link || !link.active || (link.expires_on && link.expires_on < todayISO())) return { ok: false, quote: null, error: "This booking link is invalid or has expired." };
    return doSubmit(data.booking, link.owner_id, `link: ${link.label} (${data.booking.contact_name})`, link.id);
  });

async function doSubmit(data: z.infer<typeof bookingSchema>, userId: string, actor: string, linkId: string | null): Promise<SubmitResult> {
  {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const P = await import("./planner.server");

    // Auto-create an unknown town from the geocoder (status unverified → Permit check)
    if (data.venue_type === "public_ground") {
      const { data: towns } = await admin.from("towns").select("id, name");
      let town = findTown((towns ?? []) as any, data.town) as any;
      if (!town) {
        const { data: created, error } = await admin
          .from("towns")
          .insert({
            name: data.town, permit_name: "Sondernutzungserlaubnis", issuing_authority: "Ordnungsamt (to be confirmed)", fee_model: "unknown",
            fee_amount: 0, lead_time_weeks: 0, max_trucks: 99, generators_allowed: true, quiet_hours_mode: "warn", status: "unverified",
            landkreis: data.county || null, state: data.state || null, auto_created: true,
            notes: "Created automatically from the geocoder — permit rules, fee and generator rules unknown. Verify with the town.",
          })
          .select("id, name")
          .single();
        if (error) console.error(error);
        town = created;
        if (town) await admin.from("staff_notifications").insert({ kind: "new_town", message: `New town ${data.town} (${data.county || "district unknown"}) created from a booking — complete the permit checklist.` });
      }
      if (town) await P.ensureTownChecklist(admin, town.id, town.name, data.county);
    }

    const s0 = await P.loadCtx(admin, data.event_date);
    let route;
    try {
      route = await roadDistance(s0.config.depot, { lat: data.lat, lon: data.lon });
    } catch {
      return { ok: false, quote: null, error: "We couldn't calculate the road distance right now. Please try again in a minute." };
    }
    const id = crypto.randomUUID();
    const input = { ...data, distance_km: route.km, booking_id: id };

    for (let attempt = 0; attempt < 3; attempt++) {
      const snap = await P.snapshot(admin, data.event_date);
      const ctx = await P.loadCtx(admin, data.event_date);
      const quote = buildQuote(input, ctx, { preferTruckIds: data.truck_choice });
      if (!quote.ok) return { ok: false, quote };
      if (quote.needsApproval && (!data.approver_name || !data.approver_email))
        return { ok: false, quote, error: "This order needs a second approver at your company — please enter their name and email." };

      // Whiteboard #5: Wurst needs an HGV route under its height
      let routeStatus = "not_needed";
      let routeNote: string | null = null;
      if (quote.routeCheckTruckIds.length) {
        const rule = ctx.rules.find((r) => r.rule_type === "min_clearance_route");
        const h = Number(rule?.params?.min_clearance_m ?? 3.6);
        const hgv = await hgvHeightRoute(process.env.ORS_API_KEY, ctx.config.depot, { lat: data.lat, lon: data.lon }, h);
        if (!hgv) { routeStatus = "unverified"; routeNote = "Route clearance not verified (no HGV routing key configured) — staff confirmation required."; }
        else if (!hgv.ok || (hgv.km != null && Math.abs(hgv.km - route.km) / route.km > 0.2)) { routeStatus = "unverified"; routeNote = `Route clearance not verified: ${hgv.note}${hgv.km ? ` (differs from the ${route.km} km road route)` : ""} — staff confirmation required.`; }
        else { routeStatus = "verified"; routeNote = hgv.note; }
      }

      const token = quote.needsApproval ? hex(24) : null;
      const permitStatus = quote.permitCheck ? "required" : "not_required";
      const status = quote.needsApproval ? "awaiting_approval" : quote.permitCheck || routeStatus === "unverified" ? "permit_check" : "confirmed";
      const truckIds = [...quote.trucks.map((t) => t.id), ...(quote.espressoTruckId ? [quote.espressoTruckId] : [])];
      const now = new Date().toISOString();
      const ref = "RF-" + hex(3).toUpperCase();
      const row = {
        id, ref, user_id: userId, planner_link_id: linkId, planner_token: null, status, package: data.package, event_date: data.event_date, start_time: data.start_time, end_time: data.end_time,
        venue_name: data.venue_name, address: data.address, town: data.town, lat: data.lat, lon: data.lon, venue_type: data.venue_type, has_400v: data.has_400v,
        clearance_m: data.clearance_m, space_m2: data.space_m2, guests: data.guests, vegan: data.vegan, gluten_free: data.gluten_free, halal: data.halal,
        espresso: data.espresso, company_name: data.company_name, billing_address: data.billing_address, po_number: data.po_number, contact_name: data.contact_name,
        contact_mobile: data.contact_mobile, approver_name: quote.needsApproval ? data.approver_name : null, approver_email: quote.needsApproval ? data.approver_email : null,
        approval_token: token, client_response_reason: null, truck_ids: truckIds, distance_km: route.km, distance_method: route.method, distance_computed_at: now,
        quote, total_net: quote.totalNet, total_gross: quote.totalGross, created_at: now, updated_at: now,
        county: data.county || null, state: data.state || null, sales_to_public: data.sales_to_public, alcohol_served: data.alcohol_served,
        permit_status: permitStatus, permit_reasons: quote.permitReasons, permit_number: null, permit_fee: null, permit_issued_on: null, permit_file_path: null,
        street_group: null, route_clearance_status: routeStatus, route_clearance_note: routeNote, conflict_reason: null,
      };
      const changes = P.reshuffleChanges(ctx, quote.reshuffles, `to make room for ${ref}`);
      if (status === "permit_check")
        changes.push({ id, notify: `${ref} needs a permit check: ${[...quote.permitReasons, routeNote].filter(Boolean).join(" ")}`, kind: "permit_check" } as any);
      const { error } = await admin.rpc("commit_day_plan", { _date: data.event_date, _snapshot: snap, _new: row as any, _changes: changes as any, _actor: actor });
      if (!error) return { ok: true, bookingId: id, ref, status, approvalToken: token, quote, routeNote };
      if (String(error.message).includes("stale_plan")) continue;
      console.error(error);
      if (String(error.message).includes("assignments_truck_day_uidx")) continue;
      return { ok: false, quote, error: "Saving the booking failed. Please try again." };
    }
    return { ok: false, quote: null, error: "Several bookings for this date arrived at the same time. Please submit again." };
  }
}

/** Re-run the solver for the given dates (or every future date). Any signed-in user may trigger a re-plan; it only applies engine rules. */
export const recalcDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(400).optional(), reason: z.string().max(200).default("re-plan") }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const P = await import("./planner.server");
    const today = todayISO();
    const dates = (data.dates ?? (await P.futureBookingDates(admin, today))).filter((d) => d >= today);
    const actor = (context.claims as any)?.email ?? "engine";
    const results = [];
    for (const d of [...new Set(dates)]) results.push(await P.recalcDate(admin, d, actor, data.reason));
    return { dates: results.length, changed: results.reduce((s, r) => s + r.changed, 0), conflicts: results.reduce((s, r) => s + r.conflicts, 0) };
  });

/** Client approval (public, by token), then re-plan that date. */
export const respondApproval = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128), accept: z.boolean(), reason: z.string().max(500).default("") }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const pub = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(input, { ...init, headers: h }); } },
    });
    const { data: status, error } = await pub.rpc("respond_to_approval", { _token: data.token, _accept: data.accept, _reason: data.reason });
    if (error) return { ok: false as const, error: error.message };
    const { data: b } = await pub.rpc("get_booking_by_token", { _token: data.token });
    const date = (b as any)?.event_date as string | undefined;
    if (date) {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      const P = await import("./planner.server");
      try { await P.recalcDate(admin, date, "client approver", data.accept ? "client approved a quote" : "client rejected a quote"); } catch (e) { console.error(e); }
    }
    return { ok: true as const, status: status as string };
  });

async function serverQuote(data: z.infer<typeof bookingSchema>) {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const P = await import("./planner.server");
  const ctx = await P.loadCtx(admin, data.event_date);
  const route = await roadDistance(ctx.config.depot, { lat: data.lat, lon: data.lon });
  return buildQuote({ ...data, distance_km: route.km }, ctx, { preferTruckIds: data.truck_choice });
}

/** The authoritative quote (same server code the booking uses) — shown on the review step. */
export const previewQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data }) => serverQuote(data));

export const previewQuoteByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128), booking: bookingSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await admin.from("planner_links").select("active, expires_on").eq("token", data.token).maybeSingle();
    if (!link || !link.active || (link.expires_on && link.expires_on < todayISO())) throw new Error("This booking link is invalid or has expired.");
    return serverQuote(data.booking);
  });
