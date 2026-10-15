// Server-only: runs the engine/solver against the database and commits plans
// atomically through commit_day_plan (advisory lock per event date + snapshot check).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildQuote, planDay, formatDateDE, type EngineContext } from "./engine";
import { fetchHolidaysBW, loadDateData, loadStatic, makeContext, mapDayBooking } from "./data";

type Admin = SupabaseClient<Database>;

export async function loadCtx(admin: Admin, date: string): Promise<EngineContext> {
  const s = await loadStatic(admin);
  const dd = await loadDateData(admin, date);
  return makeContext(s, dd);
}

export async function snapshot(admin: Admin, date: string): Promise<string> {
  const { data, error } = await admin.rpc("day_snapshot", { _date: date });
  if (error) throw error;
  return data as string;
}

/** Build change rows (trucks + re-priced quote) for bookings the solver moved. */
export function reshuffleChanges(ctx: EngineContext, moves: { bookingId: string; to: string[] }[], reason: string) {
  const byId = new Map(ctx.trucks.map((t) => [t.id, t.name]));
  return moves.map((m) => {
    const b = ctx.bookings!.find((x) => x.id === m.bookingId)!;
    const q = buildQuote(b.input!, ctx, { forceTruckIds: m.to });
    const from = b.truckIds.map((id) => byId.get(id)).join(", ") || "none";
    const to = m.to.map((id) => byId.get(id)).join(", ");
    const note = `Trucks re-assigned by the planner: ${from} → ${to} (${reason})`;
    return { id: m.bookingId, truck_ids: m.to, quote: q, total_net: q.totalNet, total_gross: q.totalGross, note, notify: note, kind: "reassign" };
  });
}

/** Re-run the solver for one date and commit (retries on concurrent changes). */
export async function recalcDate(admin: Admin, date: string, actor: string, reason: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const snap = await snapshot(admin, date);
    const ctx = await loadCtx(admin, date);
    const day = (ctx.bookings ?? []).filter((b) => b.event_date === date);
    if (!day.length) return { date, changed: 0, conflicts: 0 };
    const plan = planDay(date, ctx);
    const changes: any[] = reshuffleChanges(ctx, plan.changed.map((id) => ({ bookingId: id, to: plan.assign[id] })), reason);
    // bookings in conflict that fit again → restore their status
    const ids = day.map((b) => b.id);
    const { data: rows } = await admin.from("bookings").select("id, status, approval_token, client_response_reason, permit_status, route_clearance_status, conflict_reason").in("id", ids);
    for (const r of rows ?? []) {
      const assigned = plan.assign[r.id];
      if (r.status === "conflict" && assigned) {
        const b = day.find((x) => x.id === r.id)!;
        const q = buildQuote(b.input!, ctx, { forceTruckIds: assigned });
        const status = r.approval_token && !r.client_response_reason ? "awaiting_approval" : r.permit_status === "required" || r.route_clearance_status === "unverified" ? "permit_check" : "confirmed";
        const existing = changes.find((c) => c.id === r.id);
        const row = { id: r.id, truck_ids: assigned, quote: q, total_net: q.totalNet, total_gross: q.totalGross, status, conflict_reason: null, note: `Conflict resolved on ${formatDateDE(date)}`, notify: `Conflict resolved: booking fits again on ${formatDateDE(date)}`, kind: "resolved" };
        if (existing) Object.assign(existing, row);
        else changes.push(row);
      }
    }
    for (const c of plan.conflicts) {
      const r = rows?.find((x) => x.id === c.id);
      if (!r) continue;
      changes.push({ id: c.id, truck_ids: [], status: "conflict", conflict_reason: c.reason, note: `Conflict: ${c.reason}`, ...(r.status !== "conflict" ? { notify: `Booking now in conflict: ${c.reason}`, kind: "conflict" } : {}) });
    }
    if (!changes.length) return { date, changed: 0, conflicts: 0 };
    const { error } = await admin.rpc("commit_day_plan", { _date: date, _snapshot: snap, _new: null as any, _changes: changes as any, _actor: actor });
    if (!error) return { date, changed: plan.changed.length, conflicts: plan.conflicts.length };
    if (!String(error.message).includes("stale_plan")) throw error;
  }
  throw new Error(`Couldn't re-plan ${date}: too many concurrent changes`);
}

export async function futureBookingDates(admin: Admin, today: string): Promise<string[]> {
  const { data } = await admin.from("bookings").select("event_date").gte("event_date", today).in("status", ["awaiting_approval", "permit_check", "confirmed", "conflict"]);
  return [...new Set((data ?? []).map((d) => d.event_date))].sort();
}

/** Pre-filled per-town checklist (generated when a town is first used). */
export async function ensureTownChecklist(admin: Admin, townId: string, townName: string, county: string) {
  const { count } = await admin.from("town_checklist").select("id", { count: "exact", head: true }).eq("town_id", townId);
  if (count) return;
  const items = [
    { item: `Sondernutzungserlaubnis for public ground at the Ordnungsamt of ${townName}`, legal_basis: "Straßengesetz Baden-Württemberg (Sondernutzung) + local Sondernutzungssatzung", source_url: null },
    { item: `Generator / noise rules in ${townName}; TA Lärm night time 22:00–06:00 — events after 22:00 on public ground near residences`, legal_basis: "TA Lärm", source_url: null },
    { item: "Check public holidays and BW stille Feiertage (Karfreitag, Volkstrauertag, Totensonntag)", legal_basis: "Feiertagsgesetz BW", source_url: "https://date.nager.at/api/v3/PublicHolidays/2026/DE" },
    { item: `Responsible Landratsamt / Lebensmittelüberwachung for the venue's district: ${county || "unknown — look up"} (information only; may inspect, no new registration needed)`, legal_basis: "Art. 6 VO (EG) 852/2004 — registration stays with the seat (Stuttgart)", source_url: null },
    { item: `If alcohol is served: Gestattung from ${townName}`, legal_basis: "§12 GastG", source_url: "https://www.gesetze-im-internet.de/gastg/__12.html" },
    { item: "Private campus instead of public ground: written landowner consent", legal_basis: "Private property — no Sondernutzungserlaubnis", source_url: null },
  ];
  await admin.from("town_checklist").insert(items.map((x, i) => ({ ...x, town_id: townId, sort: i })));
}

export { fetchHolidaysBW, mapDayBooking };
