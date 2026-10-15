import { useEffect, useSyncExternalStore } from "react";

export type Lang = "en" | "de";
let lang: Lang = "en";
const subs = new Set<() => void>();
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem("truckops-lang", l); document.documentElement.lang = l; } catch {}
  subs.forEach((f) => f());
}

/** German translations, keyed by the English UI text. Missing keys fall back to English. */
const DE: Record<string, string> = {
  "New booking": "Neue Buchung", "My bookings": "Meine Buchungen", "Profile & places": "Profil & Orte", "Back office": "Backoffice",
  "Sign out": "Abmelden", "Sign in": "Anmelden", "Get started": "Loslegen",
  "Package": "Paket", "Date & time": "Datum & Zeit", "Venue": "Ort", "Guests & diet": "Gäste & Ernährung", "Add-ons": "Extras", "Company": "Firma", "Review": "Prüfen",
  "Book your food trucks": "Food Trucks buchen", "Every detail is required — your quote updates live.": "Alle Angaben sind Pflicht — Ihr Angebot aktualisiert sich live.",
  "Live quote": "Live-Angebot", "Back": "Zurück", "Continue": "Weiter", "Best-seller": "Bestseller", "one click": "ein Klick",
  "Custom event": "Individuelles Event", "Your times, your format.": "Ihre Zeiten, Ihr Format.", "Choose a package to continue": "Bitte ein Paket wählen",
  "Trucks": "Trucks", "We picked the best fit. You can swap to another valid combination:": "Wir haben die beste Kombination gewählt. Sie können auf eine andere gültige Kombination wechseln:",
  "selected": "ausgewählt", "Checked by our booking system.": "Von unserem Buchungssystem geprüft.", "Checking with our booking system…": "Wird von unserem Buchungssystem geprüft…",
  "Your trucks": "Ihre Trucks", "Total net": "Summe netto", "Total gross": "Summe brutto", "VAT": "USt.", "to be confirmed": "wird bestätigt",
  "What would work": "Was funktionieren würde", "Permit check before confirmation": "Genehmigungsprüfung vor Bestätigung",
  "Ready to book": "Buchbar", "Needs a second approver at your company": "Benötigt eine zweite Freigabe in Ihrem Unternehmen",
  "Why some trucks can't come": "Warum manche Trucks nicht kommen können",
  "Get an instant quote": "Sofort-Angebot erhalten", "Book the Afterwork Party": "Afterwork Party buchen",
  "Now also serving the Heilbronn region": "Jetzt auch in der Region Heilbronn",
  "Accept": "Annehmen", "Reject": "Ablehnen", "Download PDF": "PDF herunterladen", "Booking link": "Buchungslink",
};

export function translate(s: string, l: Lang = lang) {
  return l === "de" ? DE[s] ?? s : s;
}

export function useI18n() {
  const l = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => lang, () => "en" as Lang);
  return { lang: l, setLang, t: (s: string) => translate(s, l) };
}

/** Call once (root) to restore the saved language after hydration. */
export function useRestoreLang() {
  useEffect(() => {
    const saved = localStorage.getItem("truckops-lang");
    if (saved === "de" || saved === "en") setLang(saved);
  }, []);
}
