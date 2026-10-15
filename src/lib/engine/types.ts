// Pure data types for the TruckOps pricing & rules engine.
// Every number used by the engine comes from these DB-driven structures.

export type LineKey = "food" | "weekend" | "espresso" | "travel" | "generator" | "crew" | "permit";
export type VatCategory = "food" | "beverage" | "services" | "permit";

export interface TravelZone {
  max_km: number;
  fee: number;
}

export interface EngineConfig {
  per_guest_price: number;
  min_spend_per_truck: number;
  weekend_surcharge_pct: number;
  weekend_applies_to: string[]; // line keys: food, crew, travel, generator, espresso
  travel_zones: TravelZone[];
  max_distance_km: number;
  generator_fee: number;
  espresso_price: number;
  crew_max_hours: number;
  second_crew_enabled: boolean;
  second_crew_fee_per_truck: number;
  vegan_threshold_pct: number;
  vat: Record<VatCategory, number>;
  approval_threshold: number;
  approval_basis: "net" | "gross";
  /** DEPRECATED single depot — replaced by yards; used only when no yards are loaded */
  depot?: { label: string; lat: number; lon: number };
  /** charge travel for add-on vehicles (Espresso Express) like any vehicle */
  charge_addon_travel?: boolean;
  afterwork_package: { name: string; start: string; end: string };
  /** relief crews available per day for second shifts (events > crew_max_hours) */
  relief_crews_per_day?: number;
  /** bookings within this many days are locked (keep their trucks) */
  lock_days?: number;
}

export interface VatRate {
  category: VatCategory;
  rate: number;
  valid_from: string;
  valid_to: string | null;
}

export interface CrewLink {
  truck_id: string;
  crew_id: string;
  day_type: "all" | "weekday" | "weekend";
}

export interface Holiday {
  date: string;
  name: string;
  /** BW "stiller Feiertag" (Feiertagsgesetz BW) */
  silent?: boolean;
}

/** Another booking on some date, as needed by the day solver (no personal data). */
export interface DayBooking {
  id: string;
  event_date: string;
  input: EventInput | null; // null = fixed occupancy without details
  truckIds: string[];
  locked: boolean;
  status?: string;
}

export interface Truck {
  id: string;
  name: string;
  cuisine: string;
  max_guests: number;
  vegan: boolean;
  gluten_free: boolean;
  halal: boolean;
  height_m: number;
  footprint_m2: number;
  needs_400v: boolean;
  is_addon: boolean;
  status: "active" | "retired";
  /** informational; vegan implies vegetarian. Never counts toward the vegan rule. */
  vegetarian?: boolean;
  /** availability window (e.g. trucks joining from a takeover) */
  available_from?: string | null;
  available_to?: string | null;
}

export interface Yard {
  id: string;
  name: string;
  lat: number;
  lon: number;
  active_from: string | null;
  status: "active" | "planned" | "closed";
  /** relief crews available per day at this yard (second shifts) */
  relief_crews: number;
}

export interface TruckYard {
  truck_id: string;
  yard_id: string;
  valid_from: string;
  valid_to: string | null;
}

export interface Blackout {
  truck_id: string;
  start_date: string | null;
  end_date: string | null;
  recurring_month: number | null;
  reason: string;
}

export type PairRuleType =
  | "never_same_day"
  | "never_same_event"
  | "max_one_of_group_on_weekend_day"
  | "allowed_together"
  | "min_clearance_route"
  | "never_assign";

export interface PairRule {
  rule_type: PairRuleType;
  truck_ids: string[];
  description: string;
  active: boolean;
  is_system?: boolean;
  params?: Record<string, any>;
}

export type FeeModel = "per_started_m2_per_day" | "per_started_3m2_per_day" | "per_truck" | "flat" | "unknown" | "per_m2";

export interface Town {
  name: string;
  permit_name: string;
  issuing_authority: string;
  fee_model: FeeModel;
  /** DEPRECATED legacy amount; use fee_value */
  fee_amount?: number;
  fee_value?: number | null;
  fee_table?: { default_group?: string; groups?: Record<string, number> } | null;
  min_fee?: number | null;
  /** DEPRECATED legacy lead time; use lead_weeks (null = not published) */
  lead_time_weeks?: number;
  lead_weeks?: number | null;
  status?: "verified" | "unverified";
  night_warn_from?: string | null;
  authority_name?: string | null;
  landkreis?: string | null;
  max_trucks: number;
  generators_allowed: boolean;
  quiet_hours_start: string | null;
  quiet_hours_mode: "warn" | "block";
  notes: string;
  verified_on: string | null;
}

export interface ComplianceItem {
  doc_type: string;
  label: string;
  truck_id: string | null;
  crew_member: string | null;
  expires_on: string | null;
  expired: boolean;
}

export interface EventInput {
  package: string;
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM (may be past midnight)
  venue_type: "public_ground" | "private_campus";
  town: string;
  has_400v: boolean;
  clearance_m: number | null;
  space_m2: number;
  guests: number;
  vegan: number;
  gluten_free: number;
  halal: number;
  espresso: boolean;
  /** legacy single-depot distance (= nearest yard when yards are used) */
  distance_km: number;
  /** road km from each yard (yard id → km, null = unknown) */
  yard_km?: Record<string, number | null>;
  booking_id?: string;
  sales_to_public?: boolean;
  alcohol_served?: boolean;
  street_group?: string | null;
}

export interface EngineContext {
  config: EngineConfig;
  trucks: Truck[];
  blackouts: Blackout[];
  rules: PairRule[];
  towns: Town[];
  /** truck ids already booked on the event date (other bookings) */
  occupiedTruckIds: string[];
  compliance: ComplianceItem[];
  today: string; // YYYY-MM-DD
  vatRates?: VatRate[];
  crews?: CrewLink[];
  holidays?: Holiday[];
  /** other active bookings in a window around the event date */
  bookings?: DayBooking[];
  /** past usage count per truck, for balanced utilisation */
  usage?: Record<string, number>;
  yards?: Yard[];
  truckYards?: TruckYard[];
  /** open onboarding items per truck — truck can be quoted but not confirmed */
  onboardingOpen?: { truck_id: string; label: string }[];
}

export interface Issue {
  code: string;
  message: string;
  hint?: string;
}

export interface QuoteLine {
  key: LineKey;
  label: string;
  net: number;
  vatRate: number;
  category: VatCategory;
  /** amount not yet known (passed through at cost) */
  tbc?: boolean;
}

export interface Reshuffle {
  bookingId: string;
  from: string[];
  to: string[];
}

export interface VatGroup {
  rate: number;
  net: number;
  vat: number;
}

export interface Quote {
  ok: boolean;
  blockers: Issue[];
  warnings: Issue[];
  notes: string[];
  lines: QuoteLine[];
  vat: VatGroup[];
  totalNet: number;
  totalVat: number;
  totalGross: number;
  trucks: (Pick<Truck, "id" | "name" | "cuisine"> & { vegan?: boolean; vegetarian?: boolean })[];
  espressoTruckId: string | null;
  durationHours: number;
  isWeekend: boolean;
  /** total travel (sum of per-vehicle travel lines) */
  zoneFee: number | null;
  /** per-vehicle trip from its own yard */
  travel: { truck_id: string; truck: string; yard: string | null; km: number; fee: number }[];
  permitRequired: boolean;
  needsApproval: boolean;
  needsReview: boolean;
  excluded: { name: string; reason: string }[];
  /** booking must go to "Permit check" before it can be confirmed */
  permitCheck: boolean;
  permitReasons: string[];
  townUnknown: boolean;
  /** trucks whose route clearance must be verified (HGV height) */
  routeCheckTruckIds: string[];
  /** other bookings that must move to make room */
  reshuffles: Reshuffle[];
  /** other valid truck sets with the same number of vehicles (planner may swap) */
  alternatives: string[][];
  /** concrete fixes computed by the solver when infeasible */
  suggestions: string[];
}
