import { useEffect, useSyncExternalStore } from "react";
import { DE } from "./i18n-de";
import { translateDynamic } from "./i18n-dynamic";

export type Lang = "en" | "de";
export type Vars = Record<string, string | number>;

let lang: Lang = "en";
const subs = new Set<() => void>();

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem("truckops-lang", l); document.documentElement.lang = l; } catch {}
  subs.forEach((f) => f());
}

export const getLang = () => lang;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

/**
 * German text for an English UI string. Keys are the English text; `{name}`
 * placeholders are filled from `vars`. Messages built by the quote engine are
 * matched by `translateDynamic`. Anything unknown stays English.
 */
export function translate(s: string, l: Lang = lang, vars?: Vars) {
  if (l !== "de" || !s) return fill(s, vars);
  return fill(DE[s] ?? translateDynamic(s) ?? s, vars);
}

export function useI18n() {
  const l = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => lang, () => "en" as Lang);
  return { lang: l, setLang, t: (s: string, vars?: Vars) => translate(s, l, vars) };
}

/** Call once (root) to restore the saved language after hydration. */
export function useRestoreLang() {
  useEffect(() => {
    const saved = localStorage.getItem("truckops-lang");
    if (saved === "de" || saved === "en") setLang(saved);
  }, []);
}
