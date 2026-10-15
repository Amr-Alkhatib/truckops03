// Loads engine inputs from the database. Works with any Supabase client
// (browser client or per-request server client).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Blackout, ComplianceItem, EngineConfig, EngineContext, PairRule, Town, Truck } from "./engine";

type Client = SupabaseClient<Database>;

export const mapTruck = (r: any): Truck => ({
  ...r,
  max_guests: Number(r.max_guests),
  height_m: Number(r.height_m),
  footprint_m2: Number(r.footprint_m2),
});
const mapTown = (r: any): Town => ({ ...r, fee_amount: Number(r.fee_amount) });

export interface StaticData {
  config: EngineConfig;
  trucks: Truck[];
  blackouts: Blackout[];
  rules: PairRule[];
  towns: Town[];
}

export async function loadStatic(sb: Client): Promise<StaticData> {
  const [c, t, b, r, w] = await Promise.all([
    sb.from("app_config").select("config").eq("id", 1).single(),
    sb.from("trucks").select("*").order("name"),
    sb.from("truck_blackouts").select("*"),
    sb.from("pair_rules").select("*"),
    sb.from("towns").select("*").order("name"),
  ]);
  for (const x of [c, t, b, r, w]) if (x.error) throw x.error;
  return {
    config: c.data!.config as unknown as EngineConfig,
    trucks: (t.data ?? []).map(mapTruck),
    blackouts: (b.data ?? []) as Blackout[],
    rules: (r.data ?? []) as PairRule[],
    towns: (w.data ?? []).map(mapTown),
  };
}

export async function loadDateData(sb: Client, date: string) {
  const [o, c] = await Promise.all([
    sb.rpc("truck_occupancy", { _from: date, _to: date }),
    sb.rpc("compliance_status", { _on: date }),
  ]);
  if (o.error) throw o.error;
  if (c.error) throw c.error;
  return {
    occupiedTruckIds: (o.data ?? []).map((x: any) => x.truck_id as string),
    compliance: (c.data ?? []) as ComplianceItem[],
  };
}

export function todayISO(): string {
  // Europe/Berlin local date
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function makeContext(s: StaticData, d: { occupiedTruckIds: string[]; compliance: ComplianceItem[] }): EngineContext {
  return { ...s, ...d, today: todayISO() };
}
