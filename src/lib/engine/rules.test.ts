import { describe, expect, it } from "vitest";
import { buildQuote } from "./engine";
import type { EngineContext, EventInput, Truck } from "./types";
import { bookingSchema } from "../booking-schema";

const T = (name: string, o: Partial<Truck> = {}): Truck => ({
  id: name, name, cuisine: "x", max_guests: 100, vegan: false, gluten_free: false, halal: false,
  height_m: 3, footprint_m2: 18, needs_400v: false, is_addon: false, status: "active", ...o,
});

// Mirrors the seeded fleet
const FLEET: Truck[] = [
  T("Big Bertha", { height_m: 3.2, footprint_m2: 24, needs_400v: true }),
  T("Taco Loco", { vegan: true, gluten_free: true }),
  T("Salsa Sister", { gluten_free: true }),
  T("Smokey Joe", { gluten_free: true, height_m: 3.4 }),
  T("Green Machine", { vegan: true, gluten_free: true, height_m: 2.9 }),
  T("Wurst Case Scenario", { height_m: 3.6 }),
  T("Dough Bros", { vegan: true, height_m: 3.3 }),
  T("Curry Up", { vegan: true, halal: true, height_m: 3.1 }),
  T("Nonna's Pasta", { max_guests: 50, halal: true, height_m: 3.1, status: "retired" }),
  T("Pho Real", { gluten_free: true, halal: true }),
  T("Espresso Express", { max_guests: 0, height_m: 2.8, footprint_m2: 8, is_addon: true }),
];

const ctx = (o: Partial<EngineContext> = {}): EngineContext => ({
  config: {
    per_guest_price: 14, min_spend_per_truck: 1200, weekend_surcharge_pct: 20, weekend_applies_to: ["food", "crew"],
    travel_zones: [{ max_km: 10, fee: 40 }, { max_km: 25, fee: 80 }, { max_km: 40, fee: 120 }], max_distance_km: 40,
    generator_fee: 150, espresso_price: 350, crew_max_hours: 6, second_crew_enabled: true, second_crew_fee_per_truck: 180,
    vegan_threshold_pct: 15, vat: { food: 7, beverage: 19, services: 19, permit: 0 }, approval_threshold: 4000,
    approval_basis: "net", depot: { label: "Stuttgart depot", lat: 0, lon: 0 }, afterwork_package: { name: "Afterwork", start: "17:00", end: "23:30" },
  },
  trucks: FLEET,
  blackouts: [{ truck_id: "Pho Real", start_date: null, end_date: null, recurring_month: 1, reason: "every January" }],
  rules: [
    { rule_type: "never_same_day", truck_ids: ["Taco Loco", "Salsa Sister"], description: "shared crew", active: true },
    { rule_type: "max_one_of_group_on_weekend_day", truck_ids: ["Taco Loco", "Salsa Sister", "Dough Bros"], description: "weekend", active: true },
    { rule_type: "never_same_event", truck_ids: ["Green Machine", "Wurst Case Scenario"], description: "no", active: true },
    { rule_type: "allowed_together", truck_ids: ["Smokey Joe", "Green Machine"], description: "collab", active: true },
  ],
  towns: [{ name: "Stuttgart", permit_name: "SNE", issuing_authority: "OA", fee_model: "per_truck", fee_amount: 85, lead_time_weeks: 4, max_trucks: 6, generators_allowed: false, quiet_hours_start: "22:00", quiet_hours_mode: "warn", notes: "", verified_on: "2026-01-01" }],
  occupiedTruckIds: [],
  compliance: [],
  today: "2026-01-02",
  ...o,
});

const WED = "2026-06-10";
const SAT = "2026-06-13";
const ev = (o: Partial<EventInput> = {}): EventInput => ({
  package: "custom", event_date: WED, start_time: "12:00", end_time: "16:00", venue_type: "private_campus", town: "Stuttgart",
  has_400v: true, clearance_m: null, space_m2: 500, guests: 80, vegan: 0, gluten_free: 0, halal: 0, espresso: false, distance_km: 5, ...o,
});
const names = (q: ReturnType<typeof buildQuote>) => q.trucks.map((t) => t.name);

describe("business rules", () => {
  it("6.5 h Afterwork adds a second crew shift", () => {
    const q = buildQuote(ev({ start_time: "17:00", end_time: "23:30" }), ctx());
    expect(q.durationHours).toBe(6.5);
    expect(q.lines.find((l) => l.key === "crew")?.net).toBe(180);
  });
  it("blocks long events when second crew disabled", () => {
    const c = ctx(); c.config.second_crew_enabled = false;
    expect(buildQuote(ev({ start_time: "17:00", end_time: "23:30" }), c).blockers.some((b) => b.code === "crew_hours")).toBe(true);
  });
  it("blocks > 40 km with the exact distance", () => {
    const q = buildQuote(ev({ distance_km: 47.3 }), ctx());
    expect(q.ok).toBe(false);
    expect(q.blockers[0].message).toContain("47.3 km");
  });
  it("Taco Loco out → Salsa Sister can't come the same day", () => {
    const q = buildQuote(ev(), ctx({ occupiedTruckIds: ["Taco Loco"] }));
    expect(q.excluded.some((e) => e.name === "Salsa Sister")).toBe(true);
    expect(names(q)).not.toContain("Salsa Sister");
  });
  it("Taco + Salsa never together in one event", () => {
    const only = FLEET.filter((t) => ["Taco Loco", "Salsa Sister"].includes(t.name));
    const q = buildQuote(ev({ guests: 200 }), ctx({ trucks: only }));
    expect(q.ok).toBe(false);
  });
  it("weekend: Taco Loco out → Dough Bros excluded, with a helpful hint", () => {
    const q = buildQuote(ev({ event_date: SAT }), ctx({ occupiedTruckIds: ["Taco Loco"] }));
    expect(q.excluded.find((e) => e.name === "Dough Bros")?.reason).toContain("Taco Loco is already out");
    const weekday = buildQuote(ev(), ctx({ occupiedTruckIds: ["Taco Loco"] }));
    expect(weekday.excluded.some((e) => e.name === "Dough Bros")).toBe(false);
  });
  it("Green Machine + Wurst never the same event", () => {
    const only = FLEET.filter((t) => ["Green Machine", "Wurst Case Scenario"].includes(t.name));
    expect(buildQuote(ev({ guests: 150 }), ctx({ trucks: only })).ok).toBe(false);
    const allowed = FLEET.filter((t) => ["Green Machine", "Smokey Joe"].includes(t.name));
    expect(buildQuote(ev({ guests: 150 }), ctx({ trucks: allowed })).ok).toBe(true);
  });
  it("Wurst (3.6 m) excluded below 3.5 m clearance", () => {
    const q = buildQuote(ev({ clearance_m: 3.5 }), ctx());
    expect(q.excluded.find((e) => e.name === "Wurst Case Scenario")?.reason).toContain("3.6 m");
  });
  it("halal guests → Curry Up or Pho Real; Pho blocked in January", () => {
    const q = buildQuote(ev({ halal: 5 }), ctx());
    expect(["Curry Up", "Pho Real"]).toContain(names(q)[0]);
    const jan = buildQuote(ev({ halal: 5, event_date: "2027-01-13" }), ctx({ occupiedTruckIds: ["Curry Up"] }));
    expect(jan.ok).toBe(false);
    expect(jan.excluded.some((e) => e.name === "Pho Real")).toBe(true);
  });
  it("Nonna's Pasta (retired) is never assigned", () => {
    for (const g of [50, 300, 600]) expect(names(buildQuote(ev({ guests: g, halal: 1 }), ctx()))).not.toContain("Nonna's Pasta");
  });
  it("Espresso alone is blocked (needs a food truck)", () => {
    const only = FLEET.filter((t) => t.is_addon);
    const q = buildQuote(ev({ espresso: true }), ctx({ trucks: only }));
    expect(q.ok).toBe(false);
  });
  it("Espresso is billed at 19% beverage VAT", () => {
    const q = buildQuote(ev({ espresso: true }), ctx());
    expect(q.lines.find((l) => l.key === "espresso")?.vatRate).toBe(19);
  });
  it("missing PO number fails validation", () => {
    const r = bookingSchema.safeParse({ po_number: "" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.path[0] === "po_number")).toBe(true);
  });
  it("> €4,000 net requires client approval", () => {
    expect(buildQuote(ev({ guests: 300 }), ctx()).needsApproval).toBe(true);
    expect(buildQuote(ev({ guests: 80 }), ctx()).needsApproval).toBe(false);
  });
  it("VAT split 7 / 19 / 0", () => {
    const q = buildQuote(ev({ venue_type: "public_ground", event_date: "2026-06-10", espresso: true }), ctx());
    expect(q.vat.map((g) => g.rate)).toEqual([0, 7, 19]);
    const permit = q.vat.find((g) => g.rate === 0)!;
    expect(permit.vat).toBe(0);
    expect(q.totalGross).toBeCloseTo(q.totalNet + q.totalVat, 2);
  });
  it("Big Bertha without 400V: generator only if town permits", () => {
    const bb = FLEET.filter((t) => t.name === "Big Bertha");
    expect(buildQuote(ev({ has_400v: false }), ctx({ trucks: bb })).ok).toBe(false); // Stuttgart bans generators
    const c = ctx({ trucks: bb }); c.towns[0].generators_allowed = true;
    expect(buildQuote(ev({ has_400v: false }), c).lines.find((l) => l.key === "generator")?.net).toBe(150);
  });
  it("expired company document blocks booking", () => {
    const q = buildQuote(ev(), ctx({ compliance: [{ doc_type: "liability_insurance", label: "Liability insurance", truck_id: null, crew_member: null, expires_on: "2026-05-01", expired: true }] }));
    expect(q.blockers.some((b) => b.code === "compliance")).toBe(true);
  });
});
