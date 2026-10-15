import { describe, expect, it } from "vitest";
import { buildQuote, zoneFeeFor } from "./engine";
import type { EngineContext, EventInput, Truck } from "./types";

const T = (id: string, o: Partial<Truck> = {}): Truck => ({
  id, name: id, cuisine: "x", max_guests: 100, vegan: false, gluten_free: false, halal: false,
  height_m: 3, footprint_m2: 18, needs_400v: false, is_addon: false, status: "active", ...o,
});

const ctx = (o: Partial<EngineContext> = {}): EngineContext => ({
  config: {
    per_guest_price: 14, min_spend_per_truck: 1200, weekend_surcharge_pct: 20, weekend_applies_to: ["food", "crew"],
    travel_zones: [{ max_km: 10, fee: 40 }, { max_km: 25, fee: 80 }, { max_km: 40, fee: 120 }], max_distance_km: 40,
    generator_fee: 150, espresso_price: 350, crew_max_hours: 6, second_crew_enabled: true, second_crew_fee_per_truck: 180,
    vegan_threshold_pct: 15, vat: { food: 7, beverage: 19, services: 19, permit: 0 }, approval_threshold: 4000,
    approval_basis: "net", depot: { label: "depot", lat: 0, lon: 0 }, afterwork_package: { name: "A", start: "17:00", end: "23:30" },
  },
  trucks: [
    T("BigBertha", { needs_400v: true, footprint_m2: 24, height_m: 3.2 }),
    T("TacoLoco", { vegan: true, gluten_free: true }),
    T("SalsaSister", { gluten_free: true }),
    T("DoughBros", { vegan: true }),
    T("CurryUp", { vegan: true, halal: true }),
    T("Espresso", { is_addon: true, max_guests: 0, footprint_m2: 8, height_m: 2.8 }),
  ],
  blackouts: [],
  rules: [
    { rule_type: "never_same_day", truck_ids: ["TacoLoco", "SalsaSister"], description: "shared crew", active: true },
    { rule_type: "max_one_of_group_on_weekend_day", truck_ids: ["TacoLoco", "SalsaSister", "DoughBros"], description: "weekend", active: true },
  ],
  towns: [{ name: "Stuttgart", permit_name: "SNE", issuing_authority: "OA", fee_model: "per_truck", fee_amount: 50, lead_time_weeks: 4, max_trucks: 6, generators_allowed: false, quiet_hours_start: "22:00", quiet_hours_mode: "warn", notes: "", verified_on: "2026-01-01" }],
  occupiedTruckIds: [],
  compliance: [],
  today: "2026-01-01",
  ...o,
});

const ev = (o: Partial<EventInput> = {}): EventInput => ({
  package: "custom", event_date: "2026-06-10", start_time: "12:00", end_time: "16:00", venue_type: "private_campus",
  town: "Stuttgart", has_400v: true, clearance_m: null, space_m2: 200, guests: 80, vegan: 0, gluten_free: 0, halal: 0,
  espresso: false, distance_km: 5, ...o,
});

describe("engine", () => {
  it("zones", () => {
    expect(zoneFeeFor(10, ctx().config.travel_zones)).toBe(40);
    expect(zoneFeeFor(10.1, ctx().config.travel_zones)).toBe(80);
    expect(zoneFeeFor(41, ctx().config.travel_zones)).toBeNull();
  });
  it("applies minimum spend and VAT split", () => {
    const q = buildQuote(ev(), ctx());
    expect(q.ok).toBe(true);
    expect(q.trucks).toHaveLength(1);
    expect(q.lines.find((l) => l.key === "food")!.net).toBe(1200);
    expect(q.totalGross).toBe(Math.round((1200 * 1.07 + 40 * 1.19) * 100) / 100);
  });
  it("blocks > 40 km", () => {
    const q = buildQuote(ev({ distance_km: 47.3 }), ctx());
    expect(q.blockers[0].message).toContain("47.3 km");
  });
  it("adds weekend surcharge and second crew", () => {
    const q = buildQuote(ev({ event_date: "2026-06-13", start_time: "17:00", end_time: "23:30" }), ctx());
    expect(q.lines.some((l) => l.key === "crew")).toBe(true);
    expect(q.lines.filter((l) => l.key === "weekend")).toHaveLength(2);
  });
  it("respects weekend group rule against other bookings", () => {
    const q = buildQuote(ev({ event_date: "2026-06-13", guests: 100, vegan: 30 }), ctx({ occupiedTruckIds: ["TacoLoco", "CurryUp"] }));
    expect(q.ok).toBe(false);
    expect(q.excluded.some((e) => e.name === "DoughBros")).toBe(true);
  });
  it("requires halal truck", () => {
    const q = buildQuote(ev({ halal: 3 }), ctx());
    expect(q.trucks.map((t) => t.id)).toContain("CurryUp");
  });
  it("unknown town on public ground → quote produced, Permit check", () => {
    const q = buildQuote(ev({ venue_type: "public_ground", town: "Esslingen" }), ctx());
    expect(q.ok).toBe(true);
    expect(q.townUnknown).toBe(true);
    expect(q.permitCheck).toBe(true);
    expect(q.lines.find((l) => l.key === "permit")?.tbc).toBe(true);
  });
  it("permit at 0% VAT", () => {
    const q = buildQuote(ev({ venue_type: "public_ground" }), ctx());
    expect(q.lines.find((l) => l.key === "permit")!.vatRate).toBe(0);
  });
});
