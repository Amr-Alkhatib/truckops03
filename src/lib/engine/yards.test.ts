import { describe, expect, it } from "vitest";
import { buildQuote } from "./engine";
import type { EngineContext, EventInput, Truck, TruckYard, Yard } from "./types";

const T = (id: string, o: Partial<Truck> = {}): Truck => ({
  id, name: id, cuisine: "x", max_guests: 100, vegan: false, gluten_free: false, halal: false,
  height_m: 3, footprint_m2: 18, needs_400v: false, is_addon: false, status: "active", ...o,
});
const STR: Yard = { id: "S", name: "Stuttgart yard", lat: 48.78, lon: 9.18, active_from: null, status: "active", relief_crews: 2 };
const HN: Yard = { id: "H", name: "Heilbronn yard", lat: 49.14, lon: 9.21, active_from: "2026-11-01", status: "active", relief_crews: 0 };

const fleet = [
  T("Green", { vegan: true, vegetarian: true }),
  T("Curry", { vegan: true, halal: true }),
  T("Smokey", { gluten_free: true }),
  T("Kebabylon", { halal: true, available_from: "2026-11-01" }),
  T("Spaetzle", { vegetarian: true, available_from: "2026-11-01" }),
  T("Espresso", { is_addon: true, footprint_m2: 8 }),
];
const at = (truck: string, yard: string, from = "2020-01-01", to: string | null = null): TruckYard => ({ truck_id: truck, yard_id: yard, valid_from: from, valid_to: to });
const BASE_YARDS = [at("Green", "S"), at("Curry", "S"), at("Smokey", "S"), at("Espresso", "S"), at("Kebabylon", "H", "2026-11-01"), at("Spaetzle", "H", "2026-11-01")];

const ctx = (o: Partial<EngineContext> = {}): EngineContext => ({
  config: {
    per_guest_price: 14, min_spend_per_truck: 1200, weekend_surcharge_pct: 20, weekend_applies_to: ["food"],
    travel_zones: [{ max_km: 10, fee: 40 }, { max_km: 25, fee: 80 }, { max_km: 40, fee: 120 }], max_distance_km: 40, generator_fee: 150, espresso_price: 350,
    crew_max_hours: 6, second_crew_enabled: true, second_crew_fee_per_truck: 180, vegan_threshold_pct: 15, vat: { food: 7, beverage: 19, services: 19, permit: 0 },
    approval_threshold: 4000, approval_basis: "net", afterwork_package: { name: "A", start: "17:00", end: "23:30" }, charge_addon_travel: true,
  },
  trucks: fleet, blackouts: [], rules: [], towns: [], occupiedTruckIds: [], compliance: [], today: "2026-10-15", crews: [], bookings: [],
  yards: [STR, HN], truckYards: BASE_YARDS, ...o,
});
const ev = (o: Partial<EventInput> = {}): EventInput => ({
  package: "custom", event_date: "2026-11-18", start_time: "12:00", end_time: "16:00", venue_type: "private_campus",
  town: "X", has_400v: true, clearance_m: null, space_m2: 500, guests: 80, vegan: 0, gluten_free: 0, halal: 0,
  espresso: false, distance_km: 5, yard_km: { S: 5, H: 50 }, ...o,
});
const names = (q: ReturnType<typeof buildQuote>) => q.trucks.map((t) => t.id).sort();

describe("multi-yard planning", () => {
  it("tie between two equivalent trucks → the nearer yard wins (shorter trip)", () => {
    const trucks = [T("A"), T("B")];
    const q = buildQuote(ev({ yard_km: { S: 30, H: 8 } }), ctx({ trucks, truckYards: [at("A", "S"), at("B", "H")] }));
    expect(names(q)).toEqual(["B"]);
    expect(q.lines.find((l) => l.key === "travel")?.net).toBe(40);
  });

  it("Heilbronn venue with >15 % vegan guests → blocked with a yard explanation", () => {
    const q = buildQuote(ev({ guests: 100, vegan: 30, yard_km: { S: 52.4, H: 12.1 } }), ctx());
    expect(q.ok).toBe(false);
    const msg = q.blockers.map((b) => b.message).join(" ");
    expect(msg).toContain("52.4 km from our Stuttgart yard");
    expect(msg).toContain("12.1 km from our Heilbronn yard");
    expect(msg).toContain("Only Kebabylon and Spaetzle can reach you (max 200 guests)");
    expect(msg).toMatch(/vegan/);
  });

  it("vegetarian (cheese) truck never counts as vegan", () => {
    const q = buildQuote(ev({ guests: 50, vegan: 10, yard_km: { S: 60, H: 5 } }), ctx());
    expect(q.ok).toBe(false);
    expect(q.blockers.some((b) => b.code === "diet_vegan")).toBe(true);
  });

  it("halal guests near Heilbronn → Kebabylon", () => {
    const q = buildQuote(ev({ halal: 5, yard_km: { S: 55, H: 6 } }), ctx());
    expect(q.ok).toBe(true);
    expect(names(q)).toEqual(["Kebabylon"]);
    expect(q.lines.find((l) => l.key === "travel")?.label).toContain("Kebabylon from Heilbronn yard, 6.0 km, Zone 1");
  });

  it("venue between both yards mixes Stuttgart and Heilbronn trucks; travel per truck", () => {
    const q = buildQuote(ev({ guests: 180, vegan: 0, halal: 5, gluten_free: 5, yard_km: { S: 30, H: 20 } }), ctx({ trucks: fleet.filter((t) => t.id !== "Curry") }));
    expect(q.ok).toBe(true);
    expect(names(q)).toEqual(["Kebabylon", "Smokey"]);
    const travel = q.lines.filter((l) => l.key === "travel");
    expect(travel.map((l) => l.net).sort()).toEqual([120, 80]);
  });

  it("a truck moved between yards changes candidacy", () => {
    const moved = [...BASE_YARDS.filter((a) => a.truck_id !== "Green"), at("Green", "S", "2020-01-01", "2026-11-14"), at("Green", "H", "2026-11-15")];
    const venue = { guests: 50, vegan: 10, yard_km: { S: 60, H: 5 } };
    expect(buildQuote(ev(venue), ctx()).ok).toBe(false);
    const q = buildQuote(ev(venue), ctx({ truckYards: moved }));
    expect(q.ok).toBe(true);
    expect(names(q)).toEqual(["Green"]);
    expect(buildQuote(ev({ ...venue, event_date: "2026-11-10" }), ctx({ truckYards: moved })).ok).toBe(false);
  });

  it("dates before 01.11.2026 exclude Heilbronn trucks with a plain reason", () => {
    const q = buildQuote(ev({ event_date: "2026-10-28", halal: 5, yard_km: { S: 55, H: 6 } }), ctx());
    expect(q.ok).toBe(false);
    expect(q.excluded.find((e) => e.name === "Kebabylon")?.reason).toContain("Our Heilbronn yard opens on 01.11.2026");
  });

  it("long event from Heilbronn needs a Heilbronn relief crew", () => {
    const q = buildQuote(ev({ start_time: "17:00", end_time: "23:30", halal: 5, yard_km: { S: 55, H: 6 } }), ctx());
    expect(q.ok).toBe(false);
    expect(q.blockers.map((b) => b.message).join(" ")).toContain("No second crew available at the Heilbronn yard for a 6.5 h event");
  });

  it("Espresso Express must be within 40 km of its yard and is charged travel", () => {
    const far = buildQuote(ev({ espresso: true, halal: 5, yard_km: { S: 55, H: 6 } }), ctx());
    expect(far.ok).toBe(false);
    const ok = buildQuote(ev({ espresso: true, yard_km: { S: 12, H: 50 } }), ctx());
    expect(ok.ok).toBe(true);
    expect(ok.lines.filter((l) => l.key === "travel")).toHaveLength(2);
  });
});
