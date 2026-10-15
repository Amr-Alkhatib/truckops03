// Loads engine inputs from the database. Works with any Supabase client
// (browser client or per-request server client).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Blackout, ComplianceItem, CrewLink, DayBooking, EngineConfig, EngineContext, Holiday, PairRule, Town, Truck, VatRate } from "./engine";
import { addDays } from "./engine";

type Client = SupabaseClient<Database>;

export const mapTruck = (r: any): Truck => ({
  ...r,
  max_guests: Number(r.max_guests),
  height_m: Number(r.height_m),
  footprint_m2: Number(r.footprint_m2),
});
const nn = (v: any) => (v == null ? null : Number(v));
const mapTown = (r: any): Town => ({ ...r, fee_amount: Number(r.fee_amount), fee_value: nn(r.fee_value), min_fee: nn(r.min_fee), lead_weeks: r.lead_weeks ?? null });

export interface StaticData {
  config: EngineConfig;
  trucks: Truck[];
  blackouts: Blackout[];
  rules: PairRule[];
  towns: Town[];
  vatRates: VatRate[];
  crews: CrewLink[];
}

export async function loadStatic(sb: Client): Promise<StaticData> {
  const [c, t, b, r, w, v, k] = await Promise.all([
    sb.from("app_config").select("config").eq("id", 1).single(),
    sb.from("trucks").select("*").order("name"),
    sb.from("truck_blackouts").select("*"),
    sb.from("pair_rules").select("*"),
    sb.from("towns").select("*").order("name"),
    sb.from("vat_rates").select("category, rate, valid_from, valid_to"),
    sb.from("truck_crew").select("truck_id, crew_id, day_type"),
  ]);
  for (const x of [c, t, b, r, w, v, k]) if (x.error) throw x.error;
  return {
    config: c.data!.config as unknown as EngineConfig,
    trucks: (t.data ?? []).map(mapTruck),
    blackouts: (b.data ?? []) as Blackout[],
    rules: (r.data ?? []) as PairRule[],
    towns: (w.data ?? []).map(mapTown),
    vatRates: (v.data ?? []).map((x: any) => ({ ...x, rate: Number(x.rate) })) as VatRate[],
    crews: (k.data ?? []) as CrewLink[],
  };
}

export const WINDOW_DAYS = 14;

export function mapDayBooking(r: any): DayBooking {
  return {
    id: r.id,
    event_date: r.event_date,
    truckIds: r.truck_ids ?? [],
    locked: !!r.locked,
    status: r.status,
    input: {
      booking_id: r.id, package: r.package, event_date: r.event_date, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5),
      venue_type: r.venue_type, town: r.town, has_400v: r.has_400v, clearance_m: nn(r.clearance_m), space_m2: Number(r.space_m2),
      guests: r.guests, vegan: r.vegan, gluten_free: r.gluten_free, halal: r.halal, espresso: r.espresso, distance_km: Number(r.distance_km),
      sales_to_public: r.sales_to_public, alcohol_served: r.alcohol_served, street_group: r.street_group,
    },
  };
}

export interface DateData {
  occupiedTruckIds: string[];
  compliance: ComplianceItem[];
  bookings: DayBooking[];
  holidays: Holiday[];
}

/** Public holidays in Baden-Württemberg (date.nager.at, filtered to DE-BW). */
export async function fetchHolidaysBW(years: number[]): Promise<Holiday[]> {
  const out: Holiday[] = [];
  for (const y of [...new Set(years)]) {
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/DE`);
      if (!res.ok) continue;
      const list = (await res.json()) as any[];
      for (const h of list) if (h.global || (h.counties ?? []).includes("DE-BW")) out.push({ date: h.date, name: h.localName });
    } catch {
      /* holiday service unavailable: no holiday warnings */
    }
  }
  return out;
}

export async function loadDateData(sb: Client, date: string): Promise<DateData> {
  const from = addDays(date, -WINDOW_DAYS), to = addDays(date, WINDOW_DAYS);
  const [o, c, h] = await Promise.all([
    sb.rpc("day_bookings", { _from: from, _to: to }),
    sb.rpc("compliance_status", { _on: date }),
    fetchHolidaysBW([Number(from.slice(0, 4)), Number(to.slice(0, 4))]),
  ]);
  if (o.error) throw o.error;
  if (c.error) throw c.error;
  return {
    occupiedTruckIds: [],
    compliance: (c.data ?? []) as ComplianceItem[],
    bookings: (o.data ?? []).map(mapDayBooking),
    holidays: h,
  };
}

export function todayISO(): string {
  // Europe/Berlin local date
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function makeContext(s: StaticData, d: DateData): EngineContext {
  return { ...s, ...d, today: todayISO() };
}
