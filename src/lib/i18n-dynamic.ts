/**
 * German for the messages the quote engine builds at runtime ("Up to 120 guests
 * can be served on 06.12.2026."). The engine itself stays English: quotes are
 * stored and checked on the server, so the text is translated only for display.
 *
 * Each rule matches one engine template as a whole string. Unknown messages fall
 * back to English.
 */

const WEEKDAYS: Record<string, string> = {
  Monday: "Montag", Tuesday: "Dienstag", Wednesday: "Mittwoch", Thursday: "Donnerstag", Friday: "Freitag", Saturday: "Samstag", Sunday: "Sonntag",
  Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So",
};

/** Names and fragments that appear inside many messages. */
function post(s: string): string {
  return s
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(?= \d{2}\.)/g, (d) => WEEKDAYS[d] ?? d)
    .replace(/\bour ([A-ZÄÖÜ][\wäöüß-]*) yard\b/g, "unserem Depot $1")
    .replace(/\bthe ([A-ZÄÖÜ][\wäöüß-]*) yard\b/g, "dem Depot $1")
    .replace(/\b([A-ZÄÖÜ][\wäöüß-]*) yard\b/g, "Depot $1")
    .replace(/(\d+)\.(\d) km\b/g, "$1,$2 km")
    .replace(/(\d+)\.(\d) h\b/g, "$1,$2 h")
    .replace(/(\d+)\.(\d+) m\b/g, "$1,$2 m");
}

type Rule = [RegExp, string | ((m: RegExpMatchArray) => string)];

const RULES: Rule[] = [
  // ---- quote lines ----
  [/^Catering: (\d+) guests × (.+)$/, "Catering: $1 Gäste × $2"],
  [/^Catering minimum spend: (\d+) truck\(s\) × (.+)$/, "Catering-Mindestumsatz: $1 Truck(s) × $2"],
  [/^Travel – (.+) from (.+), ([\d.]+) km, Zone (\d+)$/, "Anfahrt – $1 von $2, $3 km, Zone $4"],
  [/^Travel zone \(([\d.]+) km by road\)$/, "Anfahrtszone ($1 km Straße)"],
  [/^Second crew shift \(event ([\d.]+) h > (\d+) h\) × (\d+) vehicle\(s\)$/, "Zweite Crew-Schicht (Event $1 h > $2 h) × $3 Fahrzeug(e)"],
  [/^Weekend surcharge (\d+)% on food$/, "Wochenendzuschlag $1 % auf Speisen"],
  [/^Weekend surcharge (\d+)% on (.+)$/, "Wochenendzuschlag $1 % auf $2"],
  [/^Generator for (.+) \(no 400 V on site\)$/, "Generator für $1 (kein 400 V vor Ort)"],
  [/^Espresso Express coffee bar \(flat\)$/, "Espresso-Express-Kaffeebar (pauschal)"],
  [/^(.+) — to be confirmed, passed through at cost \(no VAT\)$/, "$1 – wird bestätigt, Weitergabe zum Selbstkostenpreis (ohne USt.)"],
  [/^(.+): (.+) \(passed through at cost, no VAT\)$/, "$1: $2 (Weitergabe zum Selbstkostenpreis, ohne USt.)"],
  [/^(\d+) vehicle\(s\) × (.+)$/, "$1 Fahrzeug(e) × $2"],

  // ---- notes ----
  [/^Private company campus: no Sondernutzungserlaubnis needed — written landowner consent required\.$/, "Privates Firmengelände: keine Sondernutzungserlaubnis nötig – schriftliche Zustimmung des Grundstückseigentümers erforderlich."],
  [/^Public ground: (.+) from (.+) — fee passed through at cost\.$/, "Öffentlicher Grund: $1 von $2 – Gebühr wird zum Selbstkostenpreis weitergegeben."],
  [/^Sunday\/holiday work: each crew member gets a replacement rest day within 2 weeks and ≥ 15 free Sundays per year \(§§10–11 ArbZG\)\.$/, "Sonn-/Feiertagsarbeit: Jedes Crewmitglied erhält innerhalb von 2 Wochen einen Ersatzruhetag und mindestens 15 freie Sonntage im Jahr (§§ 10–11 ArbZG)."],
  [/^Permit check: our team confirms the permit before the booking is confirmed\.$/, "Genehmigungsprüfung: Unser Team bestätigt die Genehmigung, bevor die Buchung bestätigt wird."],
  [/^Alcohol served: a Gestattung \(§12 GastG\) from (.+) is required\.$/, (m) => `Alkoholausschank: Eine Gestattung (§ 12 GastG) von ${m[1] === "the town" ? "der Stadt" : m[1]} ist erforderlich.`],
  [/^(.+) is a public holiday in Baden-Württemberg \((.+)\)\.$/, "$1 ist ein Feiertag in Baden-Württemberg ($2)."],
  [/^(.+) is a "stiller Feiertag" \((.+), Feiertagsgesetz BW\) — public entertainment is restricted\.$/, "$1 ist ein stiller Feiertag ($2, Feiertagsgesetz BW) – öffentliche Unterhaltung ist eingeschränkt."],
  [/^Your event runs past (\d{2}:\d{2}) — TA Lärm night time \(22:00–06:00\)\. Near residences, generators and music must be kept quiet\.$/, "Ihr Event läuft über $1 hinaus – Nachtzeit nach TA Lärm (22:00–06:00). In der Nähe von Wohnhäusern müssen Generatoren und Musik leise bleiben."],
  [/^Your event runs past (.+)'s quiet hours \(from (\d{2}:\d{2})\)\.(.*)$/, (m) => `Ihr Event läuft über die Ruhezeit von ${m[1]} (ab ${m[2]}) hinaus.${m[3] ? " " + tail(m[3].trim()) : ""}`],
  [/^Ends after (\d{2}:\d{2}) on public ground \(TA Lärm night time\) — staff must confirm the late finish with (.+)\.$/, (m) => `Endet nach ${m[1]} auf öffentlichem Grund (Nachtzeit nach TA Lärm) – unser Team muss das späte Ende mit ${m[2] === "the town" ? "der Stadt" : m[2]} abstimmen.`],
  [/^(.+) isn't in our permit registry yet — our team will check the Sondernutzungserlaubnis\.$/, (m) => `${m[1] === "This town" ? "Diese Stadt" : m[1]} ist noch nicht in unserem Genehmigungsverzeichnis – unser Team prüft die Sondernutzungserlaubnis.`],
  [/^(.+): permit details are not fully verified yet\.$/, "$1: Die Genehmigungsdetails sind noch nicht vollständig geprüft."],
  [/^(.+): permit fee not published — to be confirmed\.$/, "$1: Genehmigungsgebühr nicht veröffentlicht – wird bestätigt."],
  [/^(.+) doesn't publish a lead time for the (.+)\.$/, "$1 veröffentlicht keine Vorlaufzeit für die $2."],
  [/^(.+) needs (\d+) weeks to issue the (.+)\. (.+) is only (\d+) days away\.$/, "$1 braucht $2 Wochen für die $3. Der $4 ist nur noch $5 Tage entfernt."],
  [/^Pick a date on or after (.+)\.$/, "Wählen Sie ein Datum ab dem $1."],
  [/^Selling to the public without prior order \(Reisegewerbe\) isn't allowed on Sundays or public holidays \(§55a GewO\)\.$/, "Verkauf an die Öffentlichkeit ohne Vorbestellung (Reisegewerbe) ist an Sonn- und Feiertagen nicht erlaubt (§ 55a GewO)."],
  [/^Pick a weekday or Saturday, or book it as pre-ordered corporate catering\.$/, "Wählen Sie einen Werktag oder Samstag, oder buchen Sie es als vorbestelltes Firmen-Catering."],
  [/^Selling to the public needs a valid Reisegewerbekarte \(§55 GewO\) on (\d{2}\.\d{2}\.\d{4})(.*)$/, (m) => `Der Verkauf an die Öffentlichkeit braucht am ${m[1]} eine gültige Reisegewerbekarte (§ 55 GewO)${m[2].replace(" — none is on file", " – keine hinterlegt").replace(/ — ours expires on /, " – unsere läuft ab am ").replace(/ — expires /, " – läuft ab am ")}`],
  [/^(\d+) extra truck\(s\) added: (\d+) would cover (\d+) guests, but no smaller combination serves all your (.+) guests\.$/, (m) => `${m[1]} zusätzliche(r) Truck(s): ${m[2]} würden ${m[3]} Gäste abdecken, aber keine kleinere Kombination versorgt alle Ihre ${diet(m[4])} Gäste.`],
  [/^To make room, (\d+) other booking\(s\) on (.+) will be re-assigned to different trucks\.$/, "Damit es passt, werden $1 andere Buchung(en) am $2 anderen Trucks zugeteilt."],
  [/^The trucks you picked are no longer available together on this date — we proposed the best other option\.$/, "Die gewählten Trucks sind an diesem Datum nicht mehr zusammen verfügbar – wir haben die beste Alternative vorgeschlagen."],
  [/^(.+) is still onboarding \((.+)\) — our team completes these before confirming\.$/, "$1 wird noch eingearbeitet ($2) – unser Team erledigt das vor der Bestätigung."],
  [/^Your venue is (.+) by road\.$/, (m) => `Ihr Veranstaltungsort ist ${m[1].replace(/ and /g, " und ").replace(/ from /g, " von ")} entfernt (Straße).`],

  // ---- blockers, hints and suggestions ----
  [/^The event date is in the past\.$/, "Das Eventdatum liegt in der Vergangenheit."],
  [/^Dietary counts can't be higher than the total number of guests\.$/, "Die Zahl der Gäste mit Ernährungswünschen kann nicht höher sein als die Gesamtzahl der Gäste."],
  [/^We don't travel further than (\d+) km from our yards\. (.+)$/, (m) => `Wir fahren nicht weiter als ${m[1]} km von unseren Depots. ${tail(m[2])}`],
  [/^We don't travel further than (\d+) km from (.+) — your venue is ([\d.]+) km by road\.$/, "Wir fahren nicht weiter als $1 km von $2 – Ihr Veranstaltungsort ist $3 km entfernt (Straße)."],
  [/^Up to (\d+) guests can be served on (.+)\.$/, "Am $2 können bis zu $1 Gäste versorgt werden."],
  [/^Try reducing guests to (\d+)\.$/, "Reduzieren Sie die Gästezahl auf $1."],
  [/^Shorten to ≤ (\d+) h \(end at (\d{2}:\d{2})\) and it fits\.$/, "Auf ≤ $1 h kürzen (Ende um $2), dann passt es."],
  [/^Shorten the event to ≤ (\d+) h\.$/, "Kürzen Sie das Event auf ≤ $1 h."],
  [/^Shorten the event to (\d+) hours\.$/, "Kürzen Sie das Event auf $1 Stunden."],
  [/^Nearest dates that work: (.+)\.$/, "Nächste passende Termine: $1."],
  [/^A private campus or 400 V power would allow (.+)\.$/, "Mit privatem Gelände oder 400-V-Strom wäre $1 möglich."],
  [/^Try finding a larger space\.$/, "Versuchen Sie, eine größere Fläche zu finden."],
  [/^Remove the Espresso Express add-on or choose another date\.$/, "Entfernen Sie das Espresso-Express-Extra oder wählen Sie ein anderes Datum."],
  [/^Espresso Express can't come\.$/, "Espresso Express kann nicht kommen."],
  [/^Espresso Express is not available\.$/, "Espresso Express ist nicht verfügbar."],
  [/^All suitable trucks are already booked on (.+)\.$/, "Alle passenden Trucks sind am $1 bereits gebucht."],
  [/^Only (\d+) truck\(s\) can come on (.+), covering up to (\d+) guests — you asked for (\d+)\.$/, "Am $2 können nur $1 Truck(s) kommen, für bis zu $3 Gäste – Sie haben $4 angefragt."],
  [/^More than (\d+)% of your guests are vegan, but no vegan truck is available on (.+)\.$/, "Mehr als $1 % Ihrer Gäste essen vegan, aber am $2 ist kein veganer Truck verfügbar."],
  [/^You have gluten-free guests, but no gluten-free truck is available on (.+)\.$/, "Sie haben glutenfreie Gäste, aber am $1 ist kein glutenfreier Truck verfügbar."],
  [/^You have halal guests, but no halal truck is available on (.+)\.$/, "Sie haben Halal-Gäste, aber am $1 ist kein Halal-Truck verfügbar."],
  [/^No combination of available trucks satisfies our pairing and crew rules for (\d+) guests on (.+)\.$/, "Keine Kombination verfügbarer Trucks erfüllt am $2 unsere Kombinations- und Crew-Regeln für $1 Gäste."],
  [/^The trucks needed for (\d+) guests need at least (\d+) m², but your venue has (\d+(?:[.,]\d+)?) m²\.$/, "Die Trucks für $1 Gäste brauchen mindestens $2 m², Ihr Veranstaltungsort hat $3 m²."],
  [/^The trucks you need are committed to events in the next (\d+) days \(or with issued permits\) and can't be moved\.$/, "Die benötigten Trucks sind für Events in den nächsten $1 Tagen (oder mit erteilter Genehmigung) fest eingeplant und können nicht umgeplant werden."],
  [/^Our crews work max (\d+) h per event \(ArbZG §4: break after 6 h\); yours is ([\d.]+) h and we can't add a second shift right now\.$/, "Unsere Crews arbeiten höchstens $1 h pro Event (ArbZG § 4: Pause nach 6 h); Ihres dauert $2 h, und wir können gerade keine zweite Schicht einplanen."],
  [/^All (\d+) relief crews for long events \(> (\d+) h\) are already booked on (.+)\.$/, "Alle $1 Ablöse-Crews für lange Events (> $2 h) sind am $3 bereits eingeplant."],
  [/^All second crews at the (.+) are already booked on (.+) for long events \(> (\d+) h\) — shorten to (\d+) h or our team will arrange cover\.$/, (m) => `Alle zweiten Crews ${m[1].split(" and ").map((n) => "im Depot " + n.replace(/ yard$/, "")).join(" und ")} sind am ${m[2]} für lange Events (> ${m[3]} h) bereits eingeplant – kürzen Sie auf ${m[4]} h, oder unser Team organisiert eine Vertretung.`],
  [/^No second crew available at the (.+) for a ([\d.]+) h event — shorten to (\d+) h or our team will arrange cover\.$/, (m) => `Keine zweite Crew ${m[1].split(" or ").map((n) => "im Depot " + n.replace(/ yard$/, "")).join(" oder ")} für ein ${m[2]}-h-Event verfügbar – kürzen Sie auf ${m[3]} h, oder unser Team organisiert eine Vertretung.`],
  [/^The crews for the trucks your event needs are already working other events on (.+) \(Taco Loco and Salsa Sister share one crew(; on weekends Dough Bros borrows it too)?\)\.$/, (m) => `Die Crews der Trucks, die Ihr Event braucht, arbeiten am ${m[1]} bereits bei anderen Events (Taco Loco und Salsa Sister teilen sich eine Crew${m[2] ? "; am Wochenende nutzt sie auch Dough Bros" : ""}).`],
  [/^We can't take bookings on (.+): our (.+) expires on (.+)\. Our team is renewing it\.$/, "Am $1 können wir keine Buchungen annehmen: unsere $2 läuft am $3 ab. Unser Team verlängert sie."],
  [/^No VAT rate for (.+) is configured for (.+)\. Our team needs to enter it first\.$/, "Für $1 ist zum $2 kein Umsatzsteuersatz hinterlegt. Unser Team muss ihn zuerst eintragen."],
  [/^No truck combination fits this event any more\.$/, "Für dieses Event passt keine Truck-Kombination mehr."],
  [/^Its assigned trucks no longer satisfy the rules \(locked booking — trucks can't be moved automatically\)\.$/, "Die zugeteilten Trucks erfüllen die Regeln nicht mehr (gesperrte Buchung – Trucks können nicht automatisch umgeplant werden)."],
  [/^Can't fit alongside the other bookings on (.+) \(trucks, crews or relief crews exhausted\)\.$/, "Passt am $1 nicht neben die anderen Buchungen (Trucks, Crews oder Ablöse-Crews ausgeschöpft)."],
  [/^Your venue is ([\d.]+) km from (.+) and ([\d.]+) km from (.+)\.$/, "Ihr Veranstaltungsort ist $1 km von $2 und $3 km von $4 entfernt."],

  // ---- why a truck can't come ----
  [/^(.+) is already booked on (.+)$/, "$1 ist am $2 bereits gebucht"],
  [/^(.+) is retired$/, "$1 ist außer Dienst"],
  [/^(.+) is never assignable \((.+)\)$/, "$1 ist nie einplanbar ($2)"],
  [/^(.+) is unavailable on (.+) \((.+)\)$/, (m) => `${m[1]} ist am ${m[2]} nicht verfügbar (${m[3] === "blackout" ? "Sperrzeit" : m[3]})`],
  [/^(.+) isn't assigned to a yard on (.+)$/, "$1 ist am $2 keinem Depot zugeordnet"],
  [/^(.+) joins our fleet on (.+)$/, "$1 kommt am $2 zu unserer Flotte"],
  [/^(.+) is no longer available after (.+)$/, "$1 ist nach dem $2 nicht mehr verfügbar"],
  [/^(.+) is ([\d.]+) m tall — above your ([\d.]+) m clearance$/, "$1 ist $2 m hoch – höher als Ihre Durchfahrtshöhe von $3 m"],
  [/^(.+) needs at least ([\d.]+) m clearance — your venue has ([\d.]+) m$/, "$1 braucht mindestens $2 m Durchfahrtshöhe – Ihr Veranstaltungsort hat $3 m"],
  [/^(.+) needs 400V power, and generators aren't permitted(?: in (.+))?$/, (m) => `${m[1]} braucht 400-V-Strom, und Generatoren sind${m[2] ? ` in ${m[2]}` : ""} nicht erlaubt`],
  [/^(.+) would travel ([\d.]+) km from (.+) — we go max (\d+) km$/, "$1 hätte $2 km Anfahrt von $3 – wir fahren höchstens $4 km"],
  [/^(.+): road distance from (.+) isn't available$/, "$1: Straßenentfernung von $2 ist nicht verfügbar"],
  [/^(.+): (.+) expired on (.+)$/, "$1: $2 abgelaufen am $3"],
  [/^(.+): (.+) expired — they can't be scheduled on (.+)\.$/, "$1: $2 abgelaufen – kann am $3 nicht eingeplant werden."],
  [/^(.+)'s crew is already working with (.+) on (.+)$/, "Die Crew von $1 arbeitet am $3 bereits mit $2"],
  [/^(.+) is already out on (.+), so (.+) can't come \((.+)\)$/, "$1 ist am $2 bereits unterwegs, daher kann $3 nicht kommen ($4)"],
  [/^(.+ \d{2}\.\d{2}\.\d{4}): (.+) is already out, so (.+) can't come \((.+)\)$/, "$1: $2 ist bereits unterwegs, daher kann $3 nicht kommen ($4)"],
  [/^(.+) can't work together \((.+)\)$/, "$1 können nicht zusammen arbeiten ($2)"],
  [/^Our (.+) is closed$/, (m) => `Unser Depot ${m[1].replace(/ yard$/, "")} ist geschlossen`],
  [/^Our (.+) opens on (.+) — (.+) can serve events from then$/, (m) => `Unser Depot ${m[1].replace(/ yard$/, "")} öffnet am ${m[2]} – ${m[3]} kann ab dann Events bedienen`],
  [/^None of our trucks can reach you$/, "Keiner unserer Trucks kann Sie erreichen"],
];

/** Second sentences that engine messages sometimes append. */
function tail(s: string): string {
  const own = translateDynamic(s);
  if (own) return own;
  return s
    .replace(/^Please keep noise low after that time\.$/, "Bitte halten Sie den Lärm danach gering.")
    .replace(/^Staff must check with (.+) whether a late finish is allowed\.$/, "Unser Team muss mit $1 klären, ob ein spätes Ende erlaubt ist.");
}

function diet(s: string): string {
  return s.replace("gluten-free", "glutenfreien").replace("halal", "Halal-").replace("vegan", "veganen").replace(/ and /g, " und ").replace(/, /g, ", ").replace("dietary", "Ernährungs-");
}

export function translateDynamic(s: string): string | null {
  for (const [re, out] of RULES) {
    const m = s.match(re);
    if (m) return post(typeof out === "string" ? s.replace(re, out) : out(m));
  }
  return null;
}
