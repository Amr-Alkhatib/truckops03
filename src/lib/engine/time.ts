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

export function addDays(d: string, n: number): string {
  const dt = parseISODate(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function isSunday(d: string): boolean {
  return parseISODate(d).getUTCDay() === 0;
}

/** Easter Sunday (Gregorian, anonymous algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** BW "stille Feiertage" named in the brief: Karfreitag, Volkstrauertag, Totensonntag. */
export function silentDaysBW(year: number): { date: string; name: string }[] {
  const christmas = parseISODate(`${year}-12-25`);
  const wd = christmas.getUTCDay(); // 0 = Sunday
  const fourthAdvent = addDays(`${year}-12-25`, wd === 0 ? -7 : -wd);
  const totensonntag = addDays(fourthAdvent, -28);
  return [
    { date: addDays(easterSunday(year), -2), name: "Karfreitag" },
    { date: addDays(totensonntag, -7), name: "Volkstrauertag" },
    { date: totensonntag, name: "Totensonntag" },
  ];
}
