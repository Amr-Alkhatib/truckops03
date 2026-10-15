// TruckOps pricing & rules engine — pure, deterministic, unit-testable.
// No I/O, no hard-coded prices: everything comes from EngineContext.
import type {
  EngineContext,
  EventInput,
  Issue,
  Quote,
  QuoteLine,
  Truck,
  Town,
  VatCategory,
  VatGroup,
} from "./types";
import {
  daysBetween,
  durationMinutes,
  formatDateDE,
  isInBlackout,
  isWeekend,
  runsPastQuietHours,
  weekdayName,
} from "./time";

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export function findTown(towns: Town[], name: string): Town | undefined {
  const n = name.trim().toLowerCase();
  return towns.find((t) => t.name.trim().toLowerCase() === n);
}

export function zoneFeeFor(km: number, zones: { max_km: number; fee: number }[]): number | null {
  const sorted = [...zones].sort((a, b) => a.max_km - b.max_km);
  const z = sorted.find((z) => km <= z.max_km);
  return z ? z.fee : null;
}

// ---------------------------------------------------------------------------
// Truck optimizer
// ---------------------------------------------------------------------------

export interface AssignmentResult {
  ok: boolean;
  trucks: Truck[];
  excluded: { name: string; reason: string; dateRelated: boolean }[];
  failures: Issue[];
}

interface OptimizerParams {
  input: EventInput;
  ctx: EngineContext;
  generatorsAllowed: boolean;
  maxVehicles: number; // food trucks allowed (already minus espresso)
  reservedSpace: number; // m² reserved for add-on
}

function pairRulesFor(ctx: EngineContext) {
  return ctx.rules.filter((r) => r.active && r.rule_type !== "allowed_together");
}

/** Reason a single truck can't come at all on this date/venue, or null. */
function exclusionReason(
  t: Truck,
  p: OptimizerParams,
): { reason: string; dateRelated: boolean } | null {
  const { input, ctx } = p;
  const date = formatDateDE(input.event_date);
  const byId = new Map(ctx.trucks.map((x) => [x.id, x]));
  const occupied = new Set(ctx.occupiedTruckIds);
  if (t.status === "retired") return { reason: `${t.name} is retired`, dateRelated: false };
  const bo = ctx.blackouts.find((b) => b.truck_id === t.id && isInBlackout(input.event_date, b));
  if (bo) return { reason: `${t.name} is unavailable on ${date} (${bo.reason || "blackout"})`, dateRelated: true };
  if (occupied.has(t.id)) return { reason: `${t.name} is already booked on ${date}`, dateRelated: true };
  for (const r of pairRulesFor(ctx)) {
    if (!r.truck_ids.includes(t.id)) continue;
    const busyPartner = r.truck_ids.find((id) => id !== t.id && occupied.has(id));
    if (!busyPartner) continue;
    const partner = byId.get(busyPartner)?.name ?? "a partner truck";
    if (r.rule_type === "never_same_day")
      return { reason: `${partner} is already out on ${date}, so ${t.name} can't come (${r.description})`, dateRelated: true };
    if (r.rule_type === "max_one_of_group_on_weekend_day" && isWeekend(input.event_date))
      return {
        reason: `${weekdayName(input.event_date)} ${date}: ${partner} is already out, so ${t.name} can't come (${r.description})`,
        dateRelated: true,
      };
  }
  if (input.clearance_m != null && t.height_m > input.clearance_m)
    return { reason: `${t.name} is ${t.height_m} m tall — above your ${input.clearance_m} m clearance`, dateRelated: false };
  if (t.needs_400v && !input.has_400v && !p.generatorsAllowed)
    return {
      reason: `${t.name} needs 400V power, and generators aren't permitted${input.town ? ` in ${input.town}` : ""}`,
      dateRelated: false,
    };
  const doc = ctx.compliance.find((c) => c.truck_id === t.id && c.expired);
  if (doc) return { reason: `${t.name}: ${doc.label} expired on ${formatDateDE(doc.expires_on)}`, dateRelated: false };
  return null;
}

function comboViolations(combo: Truck[], p: OptimizerParams): string[] {
  const ids = new Set(combo.map((t) => t.id));
  const byId = new Map(p.ctx.trucks.map((x) => [x.id, x]));
  const out: string[] = [];
  for (const r of pairRulesFor(p.ctx)) {
    const inCombo = r.truck_ids.filter((id) => ids.has(id));
    if (inCombo.length < 2) continue;
    const names = inCombo.map((id) => byId.get(id)?.name).join(" + ");
    if (r.rule_type === "never_same_event" || r.rule_type === "never_same_day")
      out.push(`${names} can't work together (${r.description})`);
    if (r.rule_type === "max_one_of_group_on_weekend_day" && isWeekend(p.input.event_date))
      out.push(`${names}: only one per weekend day (${r.description})`);
  }
  return out;
}

function dietOk(combo: Truck[], input: EventInput, veganThreshold: number) {
  const veganNeeded = input.guests > 0 && (input.vegan / input.guests) * 100 > veganThreshold;
  return {
    vegan: !veganNeeded || combo.some((t) => t.vegan),
    gf: input.gluten_free === 0 || combo.some((t) => t.gluten_free),
    halal: input.halal === 0 || combo.some((t) => t.halal),
    veganNeeded,
  };
}

export function assignTrucks(p: OptimizerParams): AssignmentResult {
  const { input, ctx } = p;
  const excluded: AssignmentResult["excluded"] = [];
  const candidates: Truck[] = [];
  for (const t of ctx.trucks.filter((t) => !t.is_addon)) {
    const r = exclusionReason(t, p);
    if (r) {
      if (t.status !== "retired") excluded.push({ name: t.name, ...r });
    } else candidates.push(t);
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name));

  type Eval = { combo: Truck[]; cap: number; fp: number; gens: number; valid: boolean; validIgnoringGuests: boolean };
  const evals: Eval[] = [];
  const n = candidates.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const combo = candidates.filter((_, i) => mask & (1 << i));
    if (combo.length > p.maxVehicles) continue;
    const cap = combo.reduce((s, t) => s + t.max_guests, 0);
    const fp = combo.reduce((s, t) => s + Number(t.footprint_m2), 0);
    const d = dietOk(combo, input, ctx.config.vegan_threshold_pct);
    const structural =
      d.vegan && d.gf && d.halal && fp + p.reservedSpace <= input.space_m2 && comboViolations(combo, p).length === 0;
    const gens = combo.filter((t) => t.needs_400v && !input.has_400v).length;
    evals.push({ combo, cap, fp, gens, valid: structural && cap >= input.guests, validIgnoringGuests: structural });
  }

  const valid = evals.filter((e) => e.valid);
  if (valid.length) {
    valid.sort(
      (a, b) =>
        a.combo.length - b.combo.length ||
        a.gens - b.gens ||
        a.fp - b.fp ||
        a.combo.map((t) => t.name).join().localeCompare(b.combo.map((t) => t.name).join()),
    );
    return { ok: true, trucks: valid[0].combo, excluded, failures: [] };
  }

  // ---- Explain why nothing works -----------------------------------------
  const failures: Issue[] = [];
  const date = `${weekdayName(input.event_date)} ${formatDateDE(input.event_date)}`;
  const topCap = [...candidates]
    .sort((a, b) => b.max_guests - a.max_guests)
    .slice(0, p.maxVehicles)
    .reduce((s, t) => s + t.max_guests, 0);
  const d = dietOk(candidates, input, ctx.config.vegan_threshold_pct);
  if (!d.vegan)
    failures.push({ code: "diet_vegan", message: `More than ${ctx.config.vegan_threshold_pct}% of your guests are vegan, but no vegan truck is available on ${date}.` });
  if (!d.gf) failures.push({ code: "diet_gf", message: `You have gluten-free guests, but no gluten-free truck is available on ${date}.` });
  if (!d.halal) failures.push({ code: "diet_halal", message: `You have halal guests, but no halal truck is available on ${date}.` });
  if (topCap < input.guests)
    failures.push({
      code: "capacity",
      message: `Only ${Math.min(candidates.length, p.maxVehicles)} truck(s) can come on ${date}, covering up to ${topCap} guests — you asked for ${input.guests}.`,
    });
  if (!failures.length) {
    const minFp = Math.min(...evals.filter((e) => e.cap >= input.guests).map((e) => e.fp + p.reservedSpace));
    if (isFinite(minFp) && minFp > input.space_m2)
      failures.push({
        code: "space",
        message: `The trucks needed for ${input.guests} guests need at least ${minFp} m², but your venue has ${input.space_m2} m².`,
      });
    else
      failures.push({
        code: "pairing",
        message: `No combination of available trucks satisfies our pairing rules for ${input.guests} guests on ${date}.`,
      });
  }
  const best = evals.filter((e) => e.validIgnoringGuests).reduce((m, e) => Math.max(m, e.cap), 0);
  const hints: string[] = [];
  if (best > 0 && best < input.guests) hints.push(`reducing guests to ${best}`);
  if (excluded.some((e) => e.dateRelated)) hints.push("picking another date");
  if (failures.some((f) => f.code === "space")) hints.push("finding a larger space");
  if (hints.length) failures[failures.length - 1].hint = `Try ${hints.join(" or ")}.`;
  return { ok: false, trucks: [], excluded, failures };
}

// ---------------------------------------------------------------------------
// Quote builder
// ---------------------------------------------------------------------------

export function buildQuote(input: EventInput, ctx: EngineContext): Quote {
  const cfg = ctx.config;
  const blockers: Issue[] = [];
  const warnings: Issue[] = [];
  const notes: string[] = [];
  let needsReview = false;
  const weekend = isWeekend(input.event_date);
  const durationHours = durationMinutes(input.start_time, input.end_time) / 60;
  const town = findTown(ctx.towns, input.town);
  const isPublic = input.venue_type === "public_ground";
  const dateDE = formatDateDE(input.event_date);

  // Basic data sanity
  if (input.vegan + 0 > input.guests || input.gluten_free > input.guests || input.halal > input.guests)
    blockers.push({ code: "diet_counts", message: "Dietary counts can't be higher than the total number of guests." });
  if (input.event_date < ctx.today) blockers.push({ code: "past_date", message: "The event date is in the past." });

  // Distance
  const zoneFee = zoneFeeFor(input.distance_km, cfg.travel_zones);
  if (input.distance_km > cfg.max_distance_km || zoneFee == null)
    blockers.push({
      code: "distance",
      message: `We don't travel further than ${cfg.max_distance_km} km from our ${cfg.depot.label} — your venue is ${input.distance_km.toFixed(1)} km by road.`,
    });

  // Permits / town registry
  let permitFeeBase: Town | null = null;
  if (isPublic) {
    if (!town) {
      needsReview = true;
      blockers.push({
        code: "town_unknown",
        message: `We haven't cleared permits for ${input.town || "this town"} yet — our team will contact you.`,
      });
    } else {
      permitFeeBase = town;
      const leadDays = town.lead_time_weeks * 7;
      const daysAhead = daysBetween(ctx.today, input.event_date);
      if (daysAhead < leadDays)
        blockers.push({
          code: "lead_time",
          message: `${town.name} needs ${town.lead_time_weeks} weeks to issue the ${town.permit_name}. ${dateDE} is only ${daysAhead} days away.`,
          hint: `Pick a date on or after ${formatDateDE(addDays(ctx.today, leadDays))}.`,
        });
      notes.push(`Public ground: ${town.permit_name} from ${town.issuing_authority} — fee passed through at cost.`);
      if (!town.verified_on) warnings.push({ code: "town_unverified", message: `${town.name}: permit details still being verified by our team.` });
    }
  } else {
    notes.push("Private company campus: no public-space permit needed — landowner consent required.");
  }

  // Quiet hours
  if (town?.quiet_hours_start && runsPastQuietHours(input.start_time, input.end_time, town.quiet_hours_start)) {
    const msg = `Your event runs past ${town.name}'s quiet hours (from ${town.quiet_hours_start.slice(0, 5)}).`;
    if (isPublic && town.quiet_hours_mode === "block")
      blockers.push({ code: "quiet_hours", message: msg, hint: `End the event by ${town.quiet_hours_start.slice(0, 5)}.` });
    else warnings.push({ code: "quiet_hours", message: `${msg} Please keep noise low after that time.` });
  }

  // Crew hours
  const needsSecondCrew = durationHours > cfg.crew_max_hours;
  if (needsSecondCrew && !cfg.second_crew_enabled)
    blockers.push({
      code: "crew_hours",
      message: `Our crews work max ${cfg.crew_max_hours} h per event; yours is ${durationHours.toFixed(1)} h and we can't add a second shift right now.`,
      hint: `Shorten the event to ${cfg.crew_max_hours} hours.`,
    });

  // Company compliance
  for (const c of ctx.compliance.filter((c) => !c.truck_id && c.expired))
    blockers.push({
      code: "compliance",
      message: `We can't take bookings on ${dateDE}: our ${c.label}${c.crew_member ? ` (${c.crew_member})` : ""} expires on ${formatDateDE(c.expires_on)}. Our team is renewing it.`,
    });

  // Espresso add-on
  const generatorsAllowed = town ? town.generators_allowed : true;
  let espresso: Truck | null = null;
  const espressoTruck = ctx.trucks.find((t) => t.is_addon && t.status === "active");
  if (input.espresso) {
    if (!espressoTruck) blockers.push({ code: "espresso", message: "Espresso Express is not available." });
    else {
      const probe = { input, ctx, generatorsAllowed, maxVehicles: 99, reservedSpace: 0 };
      const r = exclusionReason(espressoTruck, probe);
      if (r) blockers.push({ code: "espresso", message: r.reason, hint: "Remove the Espresso Express add-on or choose another date." });
      else espresso = espressoTruck;
    }
  }

  // Truck assignment
  const townMax = isPublic && town ? town.max_trucks : 99;
  const assignment = assignTrucks({
    input,
    ctx,
    generatorsAllowed,
    maxVehicles: Math.max(0, townMax - (espresso ? 1 : 0)),
    reservedSpace: espresso ? Number(espresso.footprint_m2) : 0,
  });
  if (!assignment.ok) blockers.push(...assignment.failures);
  const trucks = assignment.trucks;
  const vehicles = trucks.length + (espresso ? 1 : 0);

  // ---- Lines (all NET) ---------------------------------------------------
  const lines: QuoteLine[] = [];
  const vat = cfg.vat;
  const add = (key: QuoteLine["key"], label: string, net: number, category: VatCategory) => {
    if (net > 0) lines.push({ key, label, net: round2(net), vatRate: vat[category], category });
  };
  const foodTrucks = Math.max(trucks.length, 1);
  const perGuest = cfg.per_guest_price * input.guests;
  const minSpend = cfg.min_spend_per_truck * foodTrucks;
  const food = Math.max(perGuest, minSpend);
  add(
    "food",
    perGuest >= minSpend
      ? `Catering: ${input.guests} guests × ${eur(cfg.per_guest_price)}`
      : `Catering minimum spend: ${foodTrucks} truck(s) × ${eur(cfg.min_spend_per_truck)}`,
    food,
    "food",
  );
  if (espresso) add("espresso", "Espresso Express coffee bar (flat)", cfg.espresso_price, "beverage");
  if (zoneFee != null && input.distance_km <= cfg.max_distance_km)
    add("travel", `Travel zone (${input.distance_km.toFixed(1)} km by road)`, zoneFee, "services");
  const gens = trucks.filter((t) => t.needs_400v && !input.has_400v).length;
  if (gens) add("generator", `Generator for ${trucks.filter((t) => t.needs_400v && !input.has_400v).map((t) => t.name).join(", ")}`, gens * cfg.generator_fee, "services");
  if (needsSecondCrew && cfg.second_crew_enabled)
    add("crew", `Second crew shift (event ${durationHours.toFixed(1)} h > ${cfg.crew_max_hours} h) × ${vehicles} vehicle(s)`, vehicles * cfg.second_crew_fee_per_truck, "services");
  if (weekend && cfg.weekend_surcharge_pct > 0) {
    for (const l of [...lines]) {
      if (cfg.weekend_applies_to.includes(l.key))
        lines.push({
          key: "weekend",
          label: `Weekend surcharge ${cfg.weekend_surcharge_pct}% on ${l.key}`,
          net: round2((l.net * cfg.weekend_surcharge_pct) / 100),
          vatRate: l.vatRate,
          category: l.category,
        });
    }
  }
  if (permitFeeBase) {
    const t = permitFeeBase;
    const fp = trucks.reduce((s, x) => s + Number(x.footprint_m2), 0) + (espresso ? Number(espresso.footprint_m2) : 0);
    const fee = t.fee_model === "flat" ? t.fee_amount : t.fee_model === "per_truck" ? t.fee_amount * vehicles : t.fee_amount * fp;
    add("permit", `${t.permit_name} ${t.name} (passed through at cost, no VAT)`, fee, "permit");
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
    needsReview,
    excluded: assignment.excluded.map(({ name, reason }) => ({ name, reason })),
  };
}

function addDays(d: string, n: number): string {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + n));
  return dt.toISOString().slice(0, 10);
}
