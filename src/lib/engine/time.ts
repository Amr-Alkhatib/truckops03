// Pure date/time helpers (UTC-based to avoid timezone drift).

export function parseISODate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function formatDateDE(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

export function isWeekend(d: string): boolean {
  const wd = parseISODate(d).getUTCDay();
  return wd === 0 || wd === 6;
}

export function weekdayName(d: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    parseISODate(d).getUTCDay()
  ];
}

export function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/** Minutes from start to end, treating end <= start as past midnight. */
export function durationMinutes(start: string, end: string): number {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440;
  return e - s;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86400000);
}

/** True if the event (start→end) runs past the quiet-hours start time. */
export function runsPastQuietHours(start: string, end: string, quiet: string): boolean {
  const s = toMinutes(start);
  const e = s + durationMinutes(start, end);
  let q = toMinutes(quiet);
  if (q <= s) q += 1440;
  return e > q;
}

export function isInBlackout(
  date: string,
  b: { start_date: string | null; end_date: string | null; recurring_month: number | null },
): boolean {
  if (b.recurring_month != null) {
    return parseISODate(date).getUTCMonth() + 1 === b.recurring_month;
  }
  if (b.start_date && b.end_date) return date >= b.start_date && date <= b.end_date;
  if (b.start_date) return date === b.start_date;
  return false;
}
