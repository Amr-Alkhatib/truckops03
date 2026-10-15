// TruckOps pricing & rules engine — pure, deterministic, unit-testable.
// No I/O, no hard-coded prices: everything comes from EngineContext.
import type {
  ComplianceItem,
  DayBooking,
  EngineContext,
  EventInput,
  Issue,
  PairRule,
  Quote,
  QuoteLine,
  Reshuffle,
  Town,
  Truck,
  VatCategory,
  VatGroup,
} from "./types";
import {
  addDays,
  daysBetween,
  durationMinutes,
  formatDateDE,
  isInBlackout,
  isSunday,
  isWeekend,
  runsPastQuietHours,
  silentDaysBW,
  weekdayName,
} from "./time";
import { crewClash, crewOf, planExistingDay, solveDay, type Candidate, type DayRules, type SolverBooking, type SolverOptions } from "./solver";

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export function findTown(towns: Town[], name: string): Town | undefined {
  const n = name.trim().toLowerCase();
  return towns.find((t) => t.name.trim().toLowerCase() === n);
}

export function zoneFeeFor(km: number, zones: { max_km: number; fee: number }[]): number | null {
  const sorted = [...zones].sort((a, b) => a.max_km - b.max_km);
  const z = sorted.find((z) => km <= z.max_km);
  return z ? z.fee : null;
}

/** VAT rate valid on the date of service (event date). */
export function vatRateFor(ctx: EngineContext, category: VatCategory, date: string): number | null {
  if (!ctx.vatRates) return ctx.config.vat[category];
  const hits = ctx.vatRates
    .filter((r) => r.category === category && r.valid_from <= date && (!r.valid_to || r.valid_to >= date))
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
  return hits.length ? Number(hits[0].rate) : null;
}

const townFeeValue = (t: Town) => (t.fee_value !== undefined ? t.fee_value : t.fee_amount ?? null);
const townLeadWeeks = (t: Town) => (t.lead_weeks !== undefined ? t.lead_weeks : t.lead_time_weeks ?? null);
const townVerified = (t: Town) => (t.status ?? "verified") === "verified";

/** Permit fee for one event. null = unknown (to be confirmed). */
export function permitFee(
  town: Town,
  footprints: number[],
  days: number,
  streetGroup?: string | null,
): { fee: number | null; detail: string } {
  const v = townFeeValue(town);
  switch (town.fee_model) {
    case "per_started_3m2_per_day": {
      const group = streetGroup || town.fee_table?.default_group || "S";
      const rate = town.fee_table?.groups?.[group];
      if (rate == null) return { fee: null, detail: "fee table missing" };
      const units = footprints.reduce((s, fp) => s + Math.ceil(fp / 3), 0);
      const est = !streetGroup ? " — max. estimate, final amount per Gebührenbescheid" : "";
      return { fee: units * rate * days, detail: `${units} × started 3 m² × ${eur(rate)} (street group ${group})${days > 1 ? ` × ${days} days` : ""}${est}` };
    }
    case "per_started_m2_per_day": {
      if (v == null) return { fee: null, detail: "rate unknown" };
      const units = footprints.reduce((s, fp) => s + Math.ceil(fp), 0);
      const fee = Math.max(units * v * days, town.min_fee ?? 0);
      return { fee, detail: `${units} m² × ${eur(v)}${days > 1 ? ` × ${days} days` : ""}${town.min_fee ? `, min. ${eur(town.min_fee)}` : ""}` };
    }
    case "per_truck":
      return v == null ? { fee: null, detail: "rate unknown" } : { fee: v * footprints.length * days, detail: `${footprints.length} vehicle(s) × ${eur(v)}` };
    case "flat":
      return v == null ? { fee: null, detail: "rate unknown" } : { fee: v, detail: "flat fee" };
    case "per_m2":
      return v == null ? { fee: null, detail: "rate unknown" } : { fee: v * footprints.reduce((s, x) => s + x, 0), detail: "per m²" };
    default:
      return { fee: null, detail: "fee schedule not published" };
  }
}

const docExpiredOn = (c: ComplianceItem, date: string) => (c.expires_on ? c.expires_on < date : c.expired);

// ---------------------------------------------------------------------------
// Single-booking candidate generation
// ---------------------------------------------------------------------------

interface Prepared {
  input: EventInput;
  ctx: EngineContext;
  town: Town | undefined;
  generatorsAllowed: boolean;
  maxVehicles: number;
  espresso: Truck | null;
}

function activeRules(ctx: EngineContext) {
  return ctx.rules.filter((r) => r.active);
}

function allowedTogether(ctx: EngineContext, a: string, b: string) {
  return activeRules(ctx).some((r) => r.rule_type === "allowed_together" && r.truck_ids.includes(a) && r.truck_ids.includes(b));
}

/** Static reason a truck can't come to this event (independent of other bookings). */
function staticExclusion(t: Truck, p: Prepared): string | null {
  const { input, ctx } = p;
  const date = formatDateDE(input.event_date);
  if (t.status === "retired") return `${t.name} is retired`;
  for (const r of activeRules(ctx)) {
    if (!r.truck_ids.includes(t.id)) continue;
    if (r.rule_type === "never_assign") return `${t.name} is never assignable (${r.description})`;
    if (r.rule_type === "min_clearance_route") {
      const min = Number(r.params?.min_clearance_m ?? t.height_m);
      if (input.clearance_m != null && input.clearance_m < min)
        return `${t.name} needs at least ${min} m clearance — your venue has ${input.clearance_m} m`;
    }
  }
  const bo = ctx.blackouts.find((b) => b.truck_id === t.id && isInBlackout(input.event_date, b));
  if (bo) return `${t.name} is unavailable on ${date} (${bo.reason || "blackout"})`;
  if (input.clearance_m != null && t.height_m > input.clearance_m)
    return `${t.name} is ${t.height_m} m tall — above your ${input.clearance_m} m clearance`;
  if (t.needs_400v && !input.has_400v && !p.generatorsAllowed)
    return `${t.name} needs 400V power, and generators aren't permitted${input.town ? ` in ${input.town}` : ""}`;
  const doc = ctx.compliance.find((c) => c.truck_id === t.id && c.expires_on && docExpiredOn(c, input.event_date));
  if (doc) return `${t.name}: ${doc.label} expired on ${formatDateDE(doc.expires_on)}`;
  return null;
}

function comboViolations(combo: Truck[], p: Prepared): string[] {
  const ids = new Set(combo.map((t) => t.id));
  const byId = new Map(p.ctx.trucks.map((x) => [x.id, x]));
  const out: string[] = [];
  for (const r of activeRules(p.ctx)) {
    if (!["never_same_event", "never_same_day", "max_one_of_group_on_weekend_day"].includes(r.rule_type)) continue;
    const inCombo = r.truck_ids.filter((id) => ids.has(id));
    if (inCombo.length < 2) continue;
    if (inCombo.length === 2 && allowedTogether(p.ctx, inCombo[0], inCombo[1])) continue;
    if (r.rule_type === "max_one_of_group_on_weekend_day" && !isWeekend(p.input.event_date)) continue;
    out.push(`${inCombo.map((id) => byId.get(id)?.name).join(" + ")} can't work together (${r.description})`);
  }
  if (p.ctx.crews && crewClash([...ids], p.input.event_date, p.ctx.crews)) out.push("two trucks share one crew");
  return out;
}

function dietOk(combo: Truck[], input: EventInput, veganThreshold: number) {
  const veganNeeded = input.guests > 0 && (input.vegan / input.guests) * 100 > veganThreshold;
  return {
    vegan: !veganNeeded || combo.some((t) => t.vegan),
    gf: input.gluten_free === 0 || combo.some((t) => t.gluten_free),
    halal: input.halal === 0 || combo.some((t) => t.halal),
  };
}

const eventDays = (i: EventInput) => (durationMinutes(i.start_time, i.end_time) + (Number(i.start_time.slice(0, 2)) * 60 + Number(i.start_time.slice(3, 5))) > 1440 ? 2 : 1);

function prepare(input: EventInput, ctx: EngineContext): Prepared {
  const town = findTown(ctx.towns, input.town);
  const isPublic = input.venue_type === "public_ground";
  const generatorsAllowed = town ? town.generators_allowed : true;
  const espressoTruck = input.espresso ? ctx.trucks.find((t) => t.is_addon && t.status === "active") ?? null : null;
  const p: Prepared = { input, ctx, town, generatorsAllowed, maxVehicles: 99, espresso: null };
  if (espressoTruck && !staticExclusion(espressoTruck, p)) p.espresso = espressoTruck;
  const townMax = isPublic && town ? town.max_trucks : 99;
  p.maxVehicles = Math.max(0, townMax - (p.espresso ? 1 : 0));
  return p;
}

interface CandidateSet {
  cands: Candidate[];
  excluded: { name: string; reason: string }[];
  failures: Issue[];
  foodCandidates: Truck[];
}

export function candidatesFor(input: EventInput, ctx: EngineContext, p = prepare(input, ctx)): CandidateSet {
  const excluded: CandidateSet["excluded"] = [];
  const foodCandidates: Truck[] = [];
  for (const t of ctx.trucks.filter((t) => !t.is_addon)) {
    const r = staticExclusion(t, p);
    if (r) {
      if (t.status !== "retired") excluded.push({ name: t.name, reason: r });
    } else foodCandidates.push(t);
  }
  foodCandidates.sort((a, b) => a.name.localeCompare(b.name));
  const cfg = ctx.config;
  const long = durationMinutes(input.start_time, input.end_time) / 60 > cfg.crew_max_hours;
  const isPublic = input.venue_type === "public_ground";
  const days = eventDays(input);
  const reserved = p.espresso ? Number(p.espresso.footprint_m2) : 0;

  type Ev = { combo: Truck[]; cap: number; fp: number; valid: boolean; structural: boolean };
  const evals: Ev[] = [];
  const n = foodCandidates.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const combo = foodCandidates.filter((_, i) => mask & (1 << i));
    if (combo.length > p.maxVehicles) continue;
    const cap = combo.reduce((s, t) => s + t.max_guests, 0);
    const fp = combo.reduce((s, t) => s + Number(t.footprint_m2), 0);
    const d = dietOk(combo, input, cfg.vegan_threshold_pct);
    const structural = d.vegan && d.gf && d.halal && fp + reserved <= input.space_m2 && comboViolations(combo, p).length === 0;
    evals.push({ combo, cap, fp, structural, valid: structural && cap >= input.guests });
  }
  const valid = evals.filter((e) => e.valid);
  const cands: Candidate[] = valid.map((e) => {
    const all = [...e.combo, ...(p.espresso ? [p.espresso] : [])];
    const gens = e.combo.filter((t) => t.needs_400v && !input.has_400v).length;
    const pf = isPublic && p.town ? permitFee(p.town, all.map((t) => Number(t.footprint_m2)), days, input.street_group).fee ?? 0 : 0;
    return {
      ids: all.map((t) => t.id),
      vehicles: all.length,
      gens: gens * cfg.generator_fee,
      permit: pf,
      relief: long ? all.length : 0,
      usage: all.reduce((s, t) => s + (ctx.usage?.[t.id] ?? 0), 0),
    };
  });
  cands.sort((a, b) => a.vehicles - b.vehicles || a.gens - b.gens || a.permit - b.permit || a.ids.join().localeCompare(b.ids.join()));

  const failures: Issue[] = [];
  if (!cands.length) {
    const date = `${weekdayName(input.event_date)} ${formatDateDE(input.event_date)}`;
    const topCap = [...foodCandidates].sort((a, b) => b.max_guests - a.max_guests).slice(0, p.maxVehicles).reduce((s, t) => s + t.max_guests, 0);
    const d = dietOk(foodCandidates, input, cfg.vegan_threshold_pct);
    if (!d.vegan) failures.push({ code: "diet_vegan", message: `More than ${cfg.vegan_threshold_pct}% of your guests are vegan, but no vegan truck is available on ${date}.` });
    if (!d.gf) failures.push({ code: "diet_gf", message: `You have gluten-free guests, but no gluten-free truck is available on ${date}.` });
    if (!d.halal) failures.push({ code: "diet_halal", message: `You have halal guests, but no halal truck is available on ${date}.` });
    if (topCap < input.guests)
      failures.push({ code: "capacity", message: `Only ${Math.min(foodCandidates.length, p.maxVehicles)} truck(s) can come on ${date}, covering up to ${topCap} guests — you asked for ${input.guests}.` });
    if (!failures.length) {
      const minFp = Math.min(...evals.filter((e) => e.cap >= input.guests).map((e) => e.fp + reserved));
      if (isFinite(minFp) && minFp > input.space_m2)
        failures.push({ code: "space", message: `The trucks needed for ${input.guests} guests need at least ${minFp} m², but your venue has ${input.space_m2} m².`, hint: "Try finding a larger space." });
      else failures.push({ code: "pairing", message: `No combination of available trucks satisfies our pairing and crew rules for ${input.guests} guests on ${date}.` });
    }
    const best = evals.filter((e) => e.structural).reduce((m, e) => Math.max(m, e.cap), 0);
    if (best > 0 && best < input.guests) failures[failures.length - 1].hint = `Try reducing guests to ${best}.`;
  }
  return { cands: cands.slice(0, 80), excluded, failures, foodCandidates };
}

// ---------------------------------------------------------------------------
// Day context helpers
// ---------------------------------------------------------------------------

function dayRules(ctx: EngineContext, date: string, fixedIds: string[]): DayRules {
  return {
    date,
    crews: ctx.crews ?? [],
    rules: activeRules(ctx),
    reliefCap: ctx.config.second_crew_enabled ? ctx.config.relief_crews_per_day ?? 2 : 0,
    fixedIds,
  };
}

function othersOn(ctx: EngineContext, date: string, selfId?: string): DayBooking[] {
  const list = (ctx.bookings ?? []).filter((b) => b.event_date === date && b.id !== selfId);
  if (ctx.occupiedTruckIds.length && !ctx.bookings)
    list.push({ id: "__occupied", event_date: date, input: null, truckIds: ctx.occupiedTruckIds, locked: true });
  return list;
}

function toSolver(others: DayBooking[], ctx: EngineContext): { flex: SolverBooking[]; fixedIds: string[]; zero: string[] } {
  const flex: SolverBooking[] = [];
  const fixedIds: string[] = [];
  const zero: string[] = [];
  for (const o of others) {
    if (!o.input) {
      fixedIds.push(...o.truckIds);
      continue;
    }
    const c = candidatesFor(o.input, ctx).cands;
    if (!c.length) zero.push(o.id);
    flex.push({ id: o.id, cands: c, current: o.truckIds, locked: o.locked, isNew: false });
  }
  return { flex, fixedIds, zero };
}

/** Messages for trucks that can't come because locked/fixed bookings hold them or their crew. */
function occupancyExclusions(ctx: EngineContext, date: string, others: DayBooking[]): { name: string; reason: string }[] {
  const held = new Set(others.filter((o) => o.locked).flatMap((o) => o.truckIds));
  const byId = new Map(ctx.trucks.map((t) => [t.id, t]));
  const dateDE = formatDateDE(date);
  const out: { name: string; reason: string }[] = [];
  for (const t of ctx.trucks) {
    if (t.status === "retired") continue;
    if (held.has(t.id)) {
      out.push({ name: t.name, reason: `${t.name} is already booked on ${dateDE}` });
      continue;
    }
    for (const r of activeRules(ctx)) {
      if (!r.truck_ids.includes(t.id)) continue;
      const busy = r.truck_ids.find((id) => id !== t.id && held.has(id));
      if (!busy || allowedTogether(ctx, t.id, busy)) continue;
      const partner = byId.get(busy)?.name ?? "a partner truck";
      if (r.rule_type === "never_same_day") out.push({ name: t.name, reason: `${partner} is already out on ${dateDE}, so ${t.name} can't come (${r.description})` });
      else if (r.rule_type === "max_one_of_group_on_weekend_day" && isWeekend(date))
        out.push({ name: t.name, reason: `${weekdayName(date)} ${dateDE}: ${partner} is already out, so ${t.name} can't come (${r.description})` });
      else continue;
      break;
    }
    if (!out.some((x) => x.name === t.name) && ctx.crews) {
      const crew = crewOf(t.id, date, ctx.crews);
      const mate = [...held].find((id) => crewOf(id, date, ctx.crews!) === crew);
      if (mate) out.push({ name: t.name, reason: `${t.name}'s crew is already working with ${byId.get(mate)?.name} on ${dateDE}` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Quote builder
// ---------------------------------------------------------------------------

export interface QuoteOptions {
  /** use exactly these truck ids (re-pricing an existing booking) */
  forceTruckIds?: string[];
  /** planner's choice among valid options; ignored if not valid on that day */
  preferTruckIds?: string[];
  noSuggest?: boolean;
}

export function buildQuote(input: EventInput, ctx: EngineContext, opts: QuoteOptions = {}): Quote {
  const cfg = ctx.config;
  const blockers: Issue[] = [];
  const warnings: Issue[] = [];
  const notes: string[] = [];
  const permitReasons: string[] = [];
  const suggestions: string[] = [];
  const weekend = isWeekend(input.event_date);
  const durationHours = durationMinutes(input.start_time, input.end_time) / 60;
  const p = prepare(input, ctx);
  const town = p.town;
  const isPublic = input.venue_type === "public_ground";
  const dateDE = formatDateDE(input.event_date);
  const year = Number(input.event_date.slice(0, 4));
  const holiday = ctx.holidays?.find((h) => h.date === input.event_date);
  const silent = silentDaysBW(year).find((d) => d.date === input.event_date);

  if (input.vegan > input.guests || input.gluten_free > input.guests || input.halal > input.guests)
    blockers.push({ code: "diet_counts", message: "Dietary counts can't be higher than the total number of guests." });
  if (input.event_date < ctx.today) blockers.push({ code: "past_date", message: "The event date is in the past." });

  // Distance
  const zoneFee = zoneFeeFor(input.distance_km, cfg.travel_zones);
  if (input.distance_km > cfg.max_distance_km || zoneFee == null)
    blockers.push({ code: "distance", message: `We don't travel further than ${cfg.max_distance_km} km from our ${cfg.depot.label} — your venue is ${input.distance_km.toFixed(1)} km by road.` });

  // VAT by date of service
  const vat: Record<VatCategory, number> = { food: 0, beverage: 0, services: 0, permit: 0 };
  for (const c of ["food", "beverage", "services", "permit"] as VatCategory[]) {
    const r = vatRateFor(ctx, c, input.event_date);
    if (r == null) blockers.push({ code: "vat_missing", message: `No VAT rate for ${c} is configured for ${dateDE}. Our team needs to enter it first.` });
    vat[c] = r ?? 0;
  }

  // Permits / town registry
  let townUnknown = false;
  if (isPublic) {
    if (!town) {
      townUnknown = true;
      permitReasons.push(`${input.town || "This town"} isn't in our permit registry yet — our team will check the Sondernutzungserlaubnis.`);
    } else {
      const lead = townLeadWeeks(town);
      if (lead != null && lead > 0) {
        const daysAhead = daysBetween(ctx.today, input.event_date);
        if (daysAhead < lead * 7)
          blockers.push({ code: "lead_time", message: `${town.name} needs ${lead} weeks to issue the ${town.permit_name}. ${dateDE} is only ${daysAhead} days away.`, hint: `Pick a date on or after ${formatDateDE(addDays(ctx.today, lead * 7))}.` });
      } else if (lead == null) permitReasons.push(`${town.name} doesn't publish a lead time for the ${town.permit_name}.`);
      if (!townVerified(town)) permitReasons.push(`${town.name}: permit details are not fully verified yet.`);
      if (town.fee_model === "unknown" || (town.fee_model !== "per_started_3m2_per_day" && townFeeValue(town) == null))
        permitReasons.push(`${town.name}: permit fee not published — to be confirmed.`);
      notes.push(`Public ground: ${town.permit_name} from ${town.authority_name || town.issuing_authority} — fee passed through at cost.`);
    }
  } else {
    notes.push("Private company campus: no Sondernutzungserlaubnis needed — written landowner consent required.");
  }
  if (input.alcohol_served) permitReasons.push(`Alcohol served: a Gestattung (§12 GastG) from ${input.town || "the town"} is required.`);

  // Quiet hours (legacy per-town) and TA Lärm night time
  if (town?.quiet_hours_start && runsPastQuietHours(input.start_time, input.end_time, town.quiet_hours_start)) {
    const msg = `Your event runs past ${town.name}'s quiet hours (from ${town.quiet_hours_start.slice(0, 5)}).`;
    if (isPublic && town.quiet_hours_mode === "block") permitReasons.push(`${msg} Staff must check with ${town.name} whether a late finish is allowed.`);
    else warnings.push({ code: "quiet_hours", message: `${msg} Please keep noise low after that time.` });
  }
  const night = town?.night_warn_from ?? "22:00";
  if (isPublic && runsPastQuietHours(input.start_time, input.end_time, night)) {
    permitReasons.push(`Ends after ${night.slice(0, 5)} on public ground (TA Lärm night time) — staff must confirm the late finish with ${town?.name ?? "the town"}.`);
    warnings.push({ code: "ta_laerm", message: `Your event runs past ${night.slice(0, 5)} — TA Lärm night time (22:00–06:00). Near residences, generators and music must be kept quiet.` });
  }

  // Holidays
  if (holiday) warnings.push({ code: "holiday", message: `${dateDE} is a public holiday in Baden-Württemberg (${holiday.name}).` });
  if (silent) warnings.push({ code: "silent_day", message: `${dateDE} is a "stiller Feiertag" (${silent.name}, Feiertagsgesetz BW) — public entertainment is restricted.` });
  if (isSunday(input.event_date) || holiday)
    notes.push("Sunday/holiday work: each crew member gets a replacement rest day within 2 weeks and ≥ 15 free Sundays per year (§§10–11 ArbZG).");

  // Selling to the public without prior order → Reisegewerbe
  if (input.sales_to_public) {
    if (isSunday(input.event_date) || holiday)
      blockers.push({ code: "reisegewerbe_sunday", message: `Selling to the public without prior order (Reisegewerbe) isn't allowed on Sundays or public holidays (§55a GewO).`, hint: "Pick a weekday or Saturday, or book it as pre-ordered corporate catering." });
    const card = ctx.compliance.find((c) => c.doc_type === "reisegewerbekarte");
    if (!card || !card.expires_on || docExpiredOn(card, input.event_date))
      blockers.push({ code: "reisegewerbe_card", message: `Selling to the public needs a valid Reisegewerbekarte (§55 GewO) on ${dateDE}${card?.expires_on ? ` — ours expires on ${formatDateDE(card.expires_on)}` : " — none is on file"}.` });
  }

  // Crew hours
  const needsSecondCrew = durationHours > cfg.crew_max_hours;
  if (needsSecondCrew && !cfg.second_crew_enabled)
    blockers.push({ code: "crew_hours", message: `Our crews work max ${cfg.crew_max_hours} h per event (ArbZG §4: break after 6 h); yours is ${durationHours.toFixed(1)} h and we can't add a second shift right now.`, hint: `Shorten the event to ${cfg.crew_max_hours} hours.` });

  // Company compliance (required, company-level, not person-specific)
  for (const c of ctx.compliance.filter((c) => !c.truck_id && !c.crew_member && c.doc_type !== "reisegewerbekarte" && docExpiredOn(c, input.event_date) && (c as any).required !== false))
    blockers.push({ code: "compliance", message: `We can't take bookings on ${dateDE}: our ${c.label} expires on ${formatDateDE(c.expires_on)}. Our team is renewing it.` });
  for (const c of ctx.compliance.filter((c) => c.crew_member && docExpiredOn(c, input.event_date)))
    warnings.push({ code: "crew_doc", message: `${c.crew_member}: ${c.label} expired — they can't be scheduled on ${dateDE}.` });

  // Espresso
  if (input.espresso) {
    const espressoTruck = ctx.trucks.find((t) => t.is_addon && t.status === "active");
    if (!espressoTruck) blockers.push({ code: "espresso", message: "Espresso Express is not available." });
    else if (!p.espresso) blockers.push({ code: "espresso", message: staticExclusion(espressoTruck, { ...p, espresso: null }) ?? "Espresso Express can't come.", hint: "Remove the Espresso Express add-on or choose another date." });
  }

  // ---- Assignment -----------------------------------------------------------
  const cs = candidatesFor(input, ctx, p);
  const others = othersOn(ctx, input.event_date, input.booking_id);
  let excluded = [...cs.excluded];
  let chosenIds: string[] = [];
  const reshuffles: Reshuffle[] = [];
  const alternatives: string[][] = [];

  if (opts.forceTruckIds) {
    chosenIds = opts.forceTruckIds;
  } else if (!cs.cands.length) {
    blockers.push(...cs.failures);
  } else {
    const { flex, fixedIds } = toSolver(others, ctx);
    const day = dayRules(ctx, input.event_date, fixedIds);
    const me: SolverBooking = { id: "__new", cands: cs.cands, current: null, locked: false, isNew: true };
    const key = (ids: string[]) => [...ids].sort().join(",");
    const pref = opts.preferTruckIds?.length ? cs.cands.find((c) => key(c.ids) === key(opts.preferTruckIds!)) : undefined;
    let res = pref ? solveDay([{ ...me, cands: [pref] }, ...flex], day) : solveDay([me, ...flex], day);
    if (pref && !res.ok) {
      warnings.push({ code: "choice_unavailable", message: "The trucks you picked are no longer available together on this date — we proposed the best other option." });
      res = solveDay([me, ...flex], day);
    }
    if (res.ok && !opts.noSuggest) {
      const best = res.choice["__new"];
      for (const c of cs.cands) {
        if (alternatives.length >= 4) break;
        if (key(c.ids) === key(best.ids) || c.vehicles !== best.vehicles) continue;
        if (solveDay([{ ...me, cands: [c] }, ...flex], day).ok) alternatives.push(c.ids);
      }
    }
    for (const o of occupancyExclusions(ctx, input.event_date, others)) if (!excluded.some((e) => e.name === o.name)) excluded.push(o);
    if (res.ok) {
      chosenIds = res.choice["__new"].ids;
      for (const id of res.changed) {
        const prev = flex.find((f) => f.id === id)!;
        reshuffles.push({ bookingId: id, from: prev.current ?? [], to: res.choice[id].ids });
      }
    } else {
      // Find the blocking constraint family by relaxing each in turn
      const probe = (o: SolverOptions) => solveDay([me, ...flex], day, o).ok;
      const lockDays = cfg.lock_days ?? 7;
      if (probe({ relaxRelief: true }))
        blockers.push({ code: "relief_crews", message: `All ${day.reliefCap} relief crews for long events (> ${cfg.crew_max_hours} h) are already booked on ${dateDE}.`, hint: `Shorten the event to ≤ ${cfg.crew_max_hours} h.` });
      else if (probe({ relaxCrews: true }))
        blockers.push({ code: "crew_conflict", message: `The crews for the trucks your event needs are already working other events on ${dateDE} (Taco Loco and Salsa Sister share one crew${weekend ? "; on weekends Dough Bros borrows it too" : ""}).` });
      else if (probe({ relaxLocks: true }))
        blockers.push({ code: "locked", message: `The trucks you need are committed to events in the next ${lockDays} days (or with issued permits) and can't be moved.` });
      else blockers.push({ code: "fully_booked", message: `All suitable trucks are already booked on ${weekdayName(input.event_date)} ${dateDE}.` });

      // Max guests feasible on this date
      let lo = 0, hi = input.guests - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const ci = { ...input, guests: mid, vegan: Math.min(input.vegan, mid), gluten_free: Math.min(input.gluten_free, mid), halal: Math.min(input.halal, mid) };
        const cc = candidatesFor(ci, ctx).cands;
        if (cc.length && solveDay([{ ...me, cands: cc }, ...flex], day).ok) lo = mid;
        else hi = mid - 1;
      }
      if (lo > 0) suggestions.push(`Up to ${lo} guests can be served on ${dateDE}.`);
      if (needsSecondCrew) {
        const end = minutesToTime((Number(input.start_time.slice(0, 2)) * 60 + Number(input.start_time.slice(3, 5)) + cfg.crew_max_hours * 60) % 1440);
        const sc = candidatesFor({ ...input, end_time: end }, ctx).cands;
        if (sc.length && solveDay([{ ...me, cands: sc }, ...flex], day).ok) suggestions.push(`Shorten to ≤ ${cfg.crew_max_hours} h (end at ${end}) and it fits.`);
      }
    }
  }
  const bertha = excluded.find((e) => e.reason.includes("400V"));
  if (bertha && blockers.length) suggestions.push(`A private campus or 400 V power would allow ${bertha.name}.`);
  if (blockers.length && !opts.noSuggest && !opts.forceTruckIds) {
    const found: string[] = [];
    for (let k = 1; k <= 14 && found.length < 3; k++) {
      for (const d of [addDays(input.event_date, -k), addDays(input.event_date, k)]) {
        if (d < ctx.today || found.length >= 3) continue;
        if (buildQuote({ ...input, event_date: d }, ctx, { noSuggest: true }).ok) found.push(d);
      }
    }
    if (found.length) suggestions.unshift(`Nearest dates that work: ${found.sort().map((d) => `${weekdayName(d).slice(0, 3)} ${formatDateDE(d)}`).join(", ")}.`);
  }

  const byId = new Map(ctx.trucks.map((t) => [t.id, t]));
  const chosen = chosenIds.map((id) => byId.get(id)).filter(Boolean) as Truck[];
  const trucks = chosen.filter((t) => !t.is_addon);
  const espresso = chosen.find((t) => t.is_addon) ?? null;
  const vehicles = trucks.length + (espresso ? 1 : 0);
  {
    const maxCap = Math.max(...ctx.trucks.filter((t) => !t.is_addon).map((t) => t.max_guests), 1);
    const byGuests = Math.ceil(input.guests / maxCap);
    if (trucks.length > byGuests) {
      const why = [input.vegan / Math.max(input.guests, 1) * 100 > cfg.vegan_threshold_pct && "vegan", input.gluten_free > 0 && "gluten-free", input.halal > 0 && "halal"].filter(Boolean).join(", ");
      notes.push(`${trucks.length - byGuests} extra truck(s) added: ${byGuests} would cover ${input.guests} guests, but no smaller combination serves all your ${why || "dietary"} guests.`);
    }
  }
  if (!opts.forceTruckIds && chosenIds.length) excluded = excluded.filter((e) => !chosen.some((t) => t.name === e.name));

  // Route clearance (HGV height) for trucks with a min_clearance_route rule
  const routeCheckTruckIds = chosen
    .filter((t) => activeRules(ctx).some((r) => r.rule_type === "min_clearance_route" && r.truck_ids.includes(t.id)))
    .map((t) => t.id);

  // ---- Lines (all NET) ------------------------------------------------------
  const lines: QuoteLine[] = [];
  const add = (key: QuoteLine["key"], label: string, net: number, category: VatCategory, tbc = false) => {
    if (net > 0 || tbc) lines.push({ key, label, net: round2(net), vatRate: vat[category], category, ...(tbc ? { tbc } : {}) });
  };
  const foodTrucks = Math.max(trucks.length, 1);
  const perGuest = cfg.per_guest_price * input.guests;
  const minSpend = cfg.min_spend_per_truck * foodTrucks;
  add("food", perGuest >= minSpend ? `Catering: ${input.guests} guests × ${eur(cfg.per_guest_price)}` : `Catering minimum spend: ${foodTrucks} truck(s) × ${eur(cfg.min_spend_per_truck)}`, Math.max(perGuest, minSpend), "food");
  if (espresso) add("espresso", "Espresso Express coffee bar (flat)", cfg.espresso_price, "beverage");
  if (zoneFee != null && input.distance_km <= cfg.max_distance_km) add("travel", `Travel zone (${input.distance_km.toFixed(1)} km by road)`, zoneFee, "services");
  const genTrucks = trucks.filter((t) => t.needs_400v && !input.has_400v);
  if (genTrucks.length) add("generator", `Generator for ${genTrucks.map((t) => t.name).join(", ")} (no 400 V on site)`, genTrucks.length * cfg.generator_fee, "services");
  if (needsSecondCrew && cfg.second_crew_enabled)
    add("crew", `Second crew shift (event ${durationHours.toFixed(1)} h > ${cfg.crew_max_hours} h) × ${vehicles} vehicle(s)`, vehicles * cfg.second_crew_fee_per_truck, "services");
  if (weekend && cfg.weekend_surcharge_pct > 0) {
    for (const l of [...lines]) {
      if (cfg.weekend_applies_to.includes(l.key))
        lines.push({ key: "weekend", label: `Weekend surcharge ${cfg.weekend_surcharge_pct}% on ${l.key}`, net: round2((l.net * cfg.weekend_surcharge_pct) / 100), vatRate: l.vatRate, category: l.category });
    }
  }
  if (isPublic) {
    const permitName = town?.permit_name ?? "Sondernutzungserlaubnis";
    const fps = chosen.map((t) => Number(t.footprint_m2));
    const pf = town && chosen.length ? permitFee(town, fps, eventDays(input), input.street_group) : { fee: null, detail: "town not in registry" };
    if (pf.fee == null) add("permit", `${permitName} ${town?.name ?? input.town} — to be confirmed, passed through at cost (no VAT)`, 0, "permit", true);
    else add("permit", `${permitName} ${town!.name}: ${pf.detail} (passed through at cost, no VAT)`, pf.fee, "permit");
  }

  const groups = new Map<number, VatGroup>();
  for (const l of lines) {
    const g = groups.get(l.vatRate) ?? { rate: l.vatRate, net: 0, vat: 0 };
    g.net = round2(g.net + l.net);
    groups.set(l.vatRate, g);
  }
  const vatGroups = [...groups.values()].map((g) => ({ ...g, vat: round2((g.net * g.rate) / 100) })).sort((a, b) => a.rate - b.rate);
  const totalNet = round2(lines.reduce((s, l) => s + l.net, 0));
  const totalVat = round2(vatGroups.reduce((s, g) => s + g.vat, 0));
  const totalGross = round2(totalNet + totalVat);
  const basis = cfg.approval_basis === "gross" ? totalGross : totalNet;
  if (reshuffles.length) notes.push(`To make room, ${reshuffles.length} other booking(s) on ${dateDE} will be re-assigned to different trucks.`);
  if (permitReasons.length) notes.push("Permit check: our team confirms the permit before the booking is confirmed.");

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    notes,
    lines,
    vat: vatGroups,
    totalNet,
    totalVat,
    totalGross,
    trucks: trucks.map(({ id, name, cuisine }) => ({ id, name, cuisine })),
    espressoTruckId: espresso?.id ?? null,
    durationHours,
    isWeekend: weekend,
    zoneFee,
    permitRequired: isPublic,
    needsApproval: basis > cfg.approval_threshold,
    needsReview: false,
    excluded,
    permitCheck: permitReasons.length > 0,
    alternatives,
    permitReasons,
    townUnknown,
    routeCheckTruckIds,
    reshuffles,
    suggestions: [...new Set(suggestions)],
  };
}

function minutesToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Re-plan an existing day (after cancellations, fleet/rule/doc/price changes)
// ---------------------------------------------------------------------------

export interface DayPlan {
  assign: Record<string, string[]>;
  changed: string[];
  conflicts: { id: string; reason: string }[];
}

export function planDay(date: string, ctx: EngineContext): DayPlan {
  const others = othersOn(ctx, date);
  const { flex, fixedIds, zero } = toSolver(others, ctx);
  const day = dayRules(ctx, date, fixedIds);
  const reasons: Record<string, string> = {};
  for (const id of zero) {
    const b = others.find((o) => o.id === id)!;
    reasons[id] = candidatesFor(b.input!, ctx).failures.map((f) => f.message).join(" ") || "No truck combination fits this event any more.";
  }
  const lockedBad = flex.filter((f) => f.locked && f.current && !f.cands.some((c) => [...c.ids].sort().join() === [...f.current!].sort().join()));
  for (const f of lockedBad) reasons[f.id] ??= "Its assigned trucks no longer satisfy the rules (locked booking — trucks can't be moved automatically).";
  const solvable = flex.filter((f) => !reasons[f.id]);
  const { result, conflicts } = planExistingDay(solvable, day);
  for (const id of conflicts) reasons[id] = `Can't fit alongside the other bookings on ${formatDateDE(date)} (trucks, crews or relief crews exhausted).`;
  const assign: Record<string, string[]> = {};
  for (const [id, c] of Object.entries(result.choice)) assign[id] = c.ids;
  return { assign, changed: result.changed, conflicts: Object.entries(reasons).map(([id, reason]) => ({ id, reason })) };
}

export type { PairRule };
