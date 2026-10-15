import { describe, expect, it } from "vitest";
import { buildQuote, planDay } from "./engine";
import type { CrewLink, DayBooking, EngineContext, EventInput, Truck } from "./types";

const T = (id: string, o: Partial<Truck> = {}): Truck => ({
  id, name: id, cuisine: "x", max_guests: 100, vegan: false, gluten_free: false, halal: false,
  height_m: 3, footprint_m2: 18, needs_400v: false, is_addon: false, status: "active", ...o,
});

const CREWS: CrewLink[] = [
  { truck_id: "Taco", crew_id: "crewTaco", day_type: "all" },
  { truck_id: "Salsa", crew_id: "crewTaco", day_type: "all" },
  { truck_id: "Dough", crew_id: "crewDough", day_type: "weekday" },
  { truck_id: "Dough", crew_id: "crewTaco", day_type: "weekend" },
];

const ctx = (o: Partial<EngineContext> = {}): EngineContext => ({
  config: {
    per_guest_price: 14, min_spend_per_truck: 1200, weekend_surcharge_pct: 20, weekend_applies_to: ["food", "crew"],
    travel_zones: [{ max_km: 40, fee: 120 }], max_distance_km: 40, generator_fee: 150, espresso_price: 350, crew_max_hours: 6,
    second_crew_enabled: true, second_crew_fee_per_truck: 180, vegan_threshold_pct: 15, vat: { food: 7, beverage: 19, services: 19, permit: 0 },
    approval_threshold: 4000, approval_basis: "net", depot: { label: "depot", lat: 0, lon: 0 }, afterwork_package: { name: "A", start: "17:00", end: "23:30" },
    relief_crews_per_day: 2,
  },
  trucks: [],
  blackouts: [],
  rules: [
    { rule_type: "never_same_event", truck_ids: ["Green", "Wurst"], description: "Green + Wurst", active: true, is_system: true },
    { rule_type: "allowed_together", truck_ids: ["Smokey", "Green"], description: "collab", active: true, is_system: true },
  ],
  towns: [],
  occupiedTruckIds: [],
  compliance: [],
  today: "2026-01-01",
  crews: CREWS,
  bookings: [],
  ...o,
});

const ev = (o: Partial<EventInput> = {}): EventInput => ({
  package: "custom", event_date: "2026-06-10", start_time: "12:00", end_time: "16:00", venue_type: "private_campus",
  town: "Stuttgart", has_400v: true, clearance_m: null, space_m2: 500, guests: 80, vegan: 0, gluten_free: 0, halal: 0,
  espresso: false, distance_km: 5, ...o,
});
const bk = (id: string, input: EventInput, truckIds: string[], locked = false): DayBooking => ({ id, event_date: input.event_date, input, truckIds, locked });
const ids = (q: ReturnType<typeof buildQuote>) => q.trucks.map((t) => t.id).sort();

describe("crew-aware day solver", () => {
  const fleet = [T("Taco", { vegan: true, gluten_free: true, halal: true }), T("Green", { vegan: true }), T("Smokey", { gluten_free: true })];

  it("re-shuffles a flexible booking to make room (min changes)", () => {
    const b1 = bk("b1", ev({ gluten_free: 5 }), ["Taco"]);
    const q = buildQuote(ev({ guests: 150, halal: 10, vegan: 40 }), ctx({ trucks: fleet, bookings: [b1] }));
    expect(q.ok).toBe(true);
    expect(ids(q)).toContain("Taco");
    expect(q.reshuffles).toEqual([{ bookingId: "b1", from: ["Taco"], to: ["Smokey"] }]);
  });

  it("locked bookings keep their trucks → plain-words blocker", () => {
    const b1 = bk("b1", ev({ gluten_free: 5 }), ["Taco"], true);
    const q = buildQuote(ev({ halal: 10 }), ctx({ trucks: fleet, bookings: [b1] }));
    expect(q.ok).toBe(false);
    expect(q.blockers.some((b) => b.code === "locked")).toBe(true);
  });

  it("weekend: Dough Bros borrows the Taco crew", () => {
    const f = [T("Taco", { vegan: true }), T("Dough", { vegan: true }), T("Curry", { vegan: true })];
    const sat = "2026-06-13";
    const held = bk("b1", ev({ event_date: sat }), ["Dough"], true);
    const q = buildQuote(ev({ event_date: sat, vegan: 30 }), ctx({ trucks: f, bookings: [held] }));
    expect(ids(q)).toEqual(["Curry"]);
    expect(q.excluded.find((e) => e.name === "Taco")?.reason).toContain("crew");
    // Weekday: Dough has its own crew → Taco is free
    const wd = bk("b1", ev(), ["Dough"], true);
    const q2 = buildQuote(ev({ vegan: 30 }), ctx({ trucks: f.filter((t) => t.id !== "Curry"), bookings: [wd] }));
    expect(ids(q2)).toEqual(["Taco"]);
  });

  it("Taco + Salsa never at one event (shared crew)", () => {
    const q = buildQuote(ev({ guests: 200 }), ctx({ trucks: [T("Taco"), T("Salsa")] }));
    expect(q.ok).toBe(false);
  });

  it("relief crew exhaustion → shorten suggestion", () => {
    const f = [T("A"), T("B"), T("C")];
    const long = { start_time: "17:00", end_time: "23:30" };
    const held = bk("b1", ev({ ...long, guests: 150 }), ["A", "B"], true);
    const q = buildQuote(ev({ ...long }), ctx({ trucks: f, bookings: [held] }));
    expect(q.blockers.some((b) => b.code === "relief_crews")).toBe(true);
    expect(q.suggestions.some((s) => s.includes("Shorten to ≤ 6 h"))).toBe(true);
  });

  it("Wurst + Green conflict at one event, fine at separate events", () => {
    const f = [T("Green"), T("Wurst", { height_m: 3.6 })];
    expect(buildQuote(ev({ guests: 150 }), ctx({ trucks: f })).ok).toBe(false);
    const other = bk("b1", ev(), ["Green"]);
    const q = buildQuote(ev(), ctx({ trucks: f, bookings: [other] }));
    expect(ids(q)).toEqual(["Wurst"]);
    expect(q.routeCheckTruckIds).toEqual([]);
  });

  it("Smokey + Green allowed together even if an admin rule blocks them", () => {
    const f = [T("Smokey"), T("Green")];
    const c = ctx({ trucks: f });
    c.rules.push({ rule_type: "never_same_event", truck_ids: ["Smokey", "Green"], description: "admin", active: true });
    expect(buildQuote(ev({ guests: 150 }), c).ok).toBe(true);
  });

  it("suggests nearest feasible dates and max guests", () => {
    const f = [T("Taco"), T("Green")];
    const held = bk("b1", ev(), ["Taco"], true);
    const q = buildQuote(ev({ guests: 150 }), ctx({ trucks: f, bookings: [held] }));
    expect(q.ok).toBe(false);
    expect(q.suggestions[0]).toContain("09.06.2026");
    expect(q.suggestions.some((s) => s.includes("Up to 100 guests"))).toBe(true);
  });

  it("planDay flags conflicts instead of cancelling", () => {
    const f = [T("Taco", { halal: true }), T("Green")];
    const a = bk("a", ev({ halal: 2 }), ["Taco"]);
    const b = bk("b", ev({ halal: 2 }), ["Taco"]);
    const plan = planDay("2026-06-10", ctx({ trucks: f, bookings: [a, b] }));
    expect(plan.conflicts.map((c) => c.id)).toEqual(["b"]);
    expect(plan.assign.a).toEqual(["Taco"]);
  });
});
