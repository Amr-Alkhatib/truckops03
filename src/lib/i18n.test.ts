import { describe, expect, it } from "vitest";
import { translate } from "./i18n";
import { DE } from "./i18n-de";

describe("translate", () => {
  it("returns English unchanged and fills placeholders", () => {
    expect(translate("{n} guests", "en", { n: 120 })).toBe("120 guests");
    expect(translate("Not in the dictionary", "de")).toBe("Not in the dictionary");
  });

  it("uses the German dictionary with placeholders", () => {
    expect(translate("{n} guests", "de", { n: 120 })).toBe("120 Gäste");
    expect(translate("Venue type", "de")).toBe("Art des Orts");
  });

  it("keeps the same placeholders in every German entry", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const [en, de] of Object.entries(DE)) expect(names(de), en).toBe(names(en));
  });

  it("translates messages built by the quote engine", () => {
    expect(translate("Catering minimum spend: 2 truck(s) × 1.200,00 €", "de")).toBe("Catering-Mindestumsatz: 2 Truck(s) × 1.200,00 €");
    expect(translate("Travel – Curry Up from Stuttgart yard, 1.9 km, Zone 1", "de")).toBe("Anfahrt – Curry Up von Depot Stuttgart, 1,9 km, Zone 1");
    expect(translate("Up to 200 guests can be served on 06.12.2026.", "de")).toBe("Am 06.12.2026 können bis zu 200 Gäste versorgt werden.");
    expect(translate("Shorten to ≤ 6 h (end at 23:00) and it fits.", "de")).toBe("Auf ≤ 6 h kürzen (Ende um 23:00), dann passt es.");
    expect(translate("All suitable trucks are already booked on Saturday 06.12.2026.", "de")).toBe("Alle passenden Trucks sind am Samstag 06.12.2026 bereits gebucht.");
    expect(translate("Nearest dates that work: Fri 05.12.2026, Mon 08.12.2026.", "de")).toBe("Nächste passende Termine: Fr 05.12.2026, Mo 08.12.2026.");
    expect(translate("All second crews at the Stuttgart yard are already booked on 06.12.2026 for long events (> 6 h) — shorten to 6 h or our team will arrange cover.", "de")).toBe(
      "Alle zweiten Crews im Depot Stuttgart sind am 06.12.2026 für lange Events (> 6 h) bereits eingeplant – kürzen Sie auf 6 h, oder unser Team organisiert eine Vertretung.",
    );
  });
});
