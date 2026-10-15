// Crew-aware day solver: picks one truck subset per booking on a date so that
// trucks are disjoint, each crew works at most one truck that day, relief crews
// suffice and all day-level rules hold. Pure + deterministic.
import type { CrewLink, PairRule } from "./types";
import { isWeekend } from "./time";

export interface Candidate {
  ids: string[];
  vehicles: number;
  gens: number;
  permit: number;
  relief: number;
  /** relief crews needed per yard (second shifts) */
  reliefByYard?: Record<string, number>;
  /** total road km of all vehicles from their own yards */
  km?: number;
  usage: number;
}

export interface SolverBooking {
  id: string;
  cands: Candidate[];
  current: string[] | null;
  locked: boolean;
  isNew: boolean;
}

export interface SolverOptions {
  relaxRelief?: boolean;
  relaxCrews?: boolean;
  relaxLocks?: boolean;
  maxNodes?: number;
}

export interface SolverResult {
  ok: boolean;
  choice: Record<string, Candidate>;
  cost: number[];
  changed: string[];
}

export interface DayRules {
  date: string;
  crews: CrewLink[];
  rules: PairRule[];
  reliefCap: number;
  /** relief crews per yard; when set, replaces reliefCap */
  reliefCapByYard?: Record<string, number>;
  /** trucks already fixed on that day (unknown bookings / legacy occupancy) */
  fixedIds: string[];
}

export function crewOf(truckId: string, date: string, crews: CrewLink[]): string {
  const want = isWeekend(date) ? "weekend" : "weekday";
  const link = crews.find((c) => c.truck_id === truckId && c.day_type === want) ?? crews.find((c) => c.truck_id === truckId && c.day_type === "all");
  return link ? link.crew_id : `solo:${truckId}`;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

function allowedPair(rules: PairRule[], a: string, b: string) {
  return rules.some((r) => r.active && r.rule_type === "allowed_together" && r.truck_ids.includes(a) && r.truck_ids.includes(b));
}

/** Day-level rule violations for the full set of trucks out on one date. */
export function dayRuleViolations(ids: Set<string>, date: string, rules: PairRule[]): PairRule[] {
  const out: PairRule[] = [];
  for (const r of rules) {
    if (!r.active) continue;
    const hit = r.truck_ids.filter((id) => ids.has(id));
    if (hit.length < 2) continue;
    if (hit.length === 2 && allowedPair(rules, hit[0], hit[1])) continue;
    if (r.rule_type === "never_same_day") out.push(r);
    if (r.rule_type === "max_one_of_group_on_weekend_day" && isWeekend(date)) out.push(r);
  }
  return out;
}

export function crewClash(ids: string[], date: string, crews: CrewLink[]): boolean {
  const seen = new Set<string>();
  for (const id of ids) {
    const c = crewOf(id, date, crews);
    if (seen.has(c)) return true;
    seen.add(c);
  }
  return false;
}

const lexLess = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

export function solveDay(bookings: SolverBooking[], day: DayRules, opts: SolverOptions = {}): SolverResult {
  const maxNodes = opts.maxNodes ?? 200_000;
  const prepared = bookings.map((b) => {
    let cands = b.cands;
    if (b.locked && !opts.relaxLocks && b.current) cands = cands.filter((c) => sameSet(c.ids, b.current!));
    else if (b.current) cands = [...cands].sort((x, y) => Number(!sameSet(y.ids, b.current!)) - Number(!sameSet(x.ids, b.current!)));
    return { ...b, cands };
  });
  // most constrained first (locked bookings have 1 candidate)
  prepared.sort((a, b) => a.cands.length - b.cands.length);

  const baseT = new Set(day.fixedIds);
  const baseC = new Set(day.fixedIds.map((id) => crewOf(id, day.date, day.crews)));
  let best: { cost: number[]; choice: Record<string, Candidate> } | null = null;
  let nodes = 0;
  const choice: Record<string, Candidate> = {};

  const fitsRelief = (used: Record<string, number>, c: Candidate) => {
    if (!day.reliefCapByYard || !c.reliefByYard) return true;
    return Object.entries(c.reliefByYard).every(([y, n]) => (used[y] ?? 0) + n <= (day.reliefCapByYard![y] ?? 0));
  };
  const addRelief = (used: Record<string, number>, c: Candidate) => {
    if (!c.reliefByYard) return used;
    const n = { ...used };
    for (const [y, k] of Object.entries(c.reliefByYard)) n[y] = (n[y] ?? 0) + k;
    return n;
  };
  const dfs = (i: number, usedT: Set<string>, usedC: Set<string>, relief: number, cost: number[], reliefY: Record<string, number> = {}) => {
    if (nodes++ > maxNodes) return;
    if (i === prepared.length) {
      if (!best || lexLess(cost, best.cost)) best = { cost, choice: { ...choice } };
      return;
    }
    const b = prepared[i];
    for (const c of b.cands) {
      if (c.ids.some((id) => usedT.has(id))) continue;
      if (!opts.relaxRelief && (day.reliefCapByYard ? !fitsRelief(reliefY, c) : relief + c.relief > day.reliefCap)) continue;
      const nextT = new Set(usedT);
      c.ids.forEach((id) => nextT.add(id));
      let nextC = usedC;
      if (!opts.relaxCrews) {
        const crews = c.ids.map((id) => crewOf(id, day.date, day.crews));
        if (crews.some((x) => usedC.has(x)) || new Set(crews).size !== crews.length) continue;
        if (dayRuleViolations(nextT, day.date, day.rules).length) continue;
        nextC = new Set(usedC);
        crews.forEach((x) => nextC.add(x));
      }
      const change = !b.isNew && b.current && !sameSet(c.ids, b.current) ? 1 : 0;
      // lexicographic: fewest trucks, fewest changes, shortest trips, generator, permit, utilisation
      const nc = [cost[0] + c.vehicles, cost[1] + change, cost[2] + Math.round((c.km ?? 0) * 10), cost[3] + c.gens, cost[4] + c.permit, cost[5] + c.usage];
      if (best && !lexLess(nc, best.cost)) continue;
      choice[b.id] = c;
      dfs(i + 1, nextT, nextC, relief + c.relief, nc, addRelief(reliefY, c));
      delete choice[b.id];
    }
  };
  dfs(0, baseT, opts.relaxCrews ? new Set() : baseC, 0, [0, 0, 0, 0, 0, 0]);

  if (!best) return { ok: false, choice: {}, cost: [], changed: [] };
  const found = best as { cost: number[]; choice: Record<string, Candidate> };
  const changed = prepared.filter((b) => !b.isNew && b.current && !sameSet(found.choice[b.id].ids, b.current)).map((b) => b.id);
  return { ok: true, choice: found.choice, cost: found.cost, changed };
}

/**
 * Re-plan an existing day. When infeasible, drops the most recently added
 * bookings (never locked ones first) until the rest fit; dropped = conflicts.
 */
export function planExistingDay(bookings: SolverBooking[], day: DayRules): { result: SolverResult; conflicts: string[] } {
  let active = [...bookings];
  const conflicts: string[] = [];
  let r = solveDay(active, day);
  while (!r.ok && active.length) {
    // prefer dropping unlocked, latest first
    const idx = [...active].map((b, i) => ({ b, i })).reverse().find((x) => !x.b.locked)?.i ?? active.length - 1;
    conflicts.push(active[idx].id);
    active = active.filter((_, i) => i !== idx);
    r = solveDay(active, day);
  }
  return { result: r, conflicts };
}
