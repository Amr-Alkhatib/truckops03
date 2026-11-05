# TruckOps
 
**Booking, pricing and fleet planning for a corporate food-truck caterer in Baden-Württemberg.**
 
A client books an event, gets a live, legally correct quote in seconds and sees exactly which trucks will come. If the event can't be served, it gets a plain-language reason and the nearest dates that would work.
 
**Live demo:** https://truckops03.lovable.app · Built for a real problem brought by a partner company to the TUM Business Game (October 2026).
 
<!-- Add a screenshot: put an image at docs/screenshot.png and remove these comment markers.
![TruckOps booking flow](docs/screenshot.png)
-->
 
---
 
## The problem
 
Every quote used to be done by hand. For each event, staff had to check the town's street-use permit rules and fees, night-time noise limits, crew working hours and rest days, road distance from the depot, power supply, dietary coverage and the split between 7 % and 19 % VAT. Then they had to work out which trucks were even free that day.
 
## What TruckOps does
 
- **Booking wizard with a live quote.** Venue, guests, diets and times go in. A net B2B quote with every line explained comes out.
- **Automatic truck assignment.** It picks the fewest trucks that cover every guest and diet, and explains why any truck can't come.
- **Explains infeasibility instead of failing.** When no plan fits, the solver names the blocker in plain words and suggests the nearest working dates (±14 days), the maximum number of guests that would fit, or a shorter event.
- **Back office.** Fleet, two depots (Stuttgart and Heilbronn), pricing, towns and permit fees, crews, compliance documents, approvals, an audit log and users with roles.
- **German rules encoded as data.** Permit fees per town, TA Lärm after 22:00, §12 GastG, ArbZG rest periods, §43 IfSG, Baden-Württemberg public holidays (fetched live) and the VAT split. Every legal value is stored with its source and check date. Unknown values stay `NULL` and send the booking to *Permit check* instead of inventing a number.
## Engineering highlights
 
| | |
|---|---|
| **Solver** (`src/lib/engine/solver.ts`) | Backtracking search, most-constrained booking first, branch & bound on a lexicographic cost: feasibility → fewest trucks → fewest changes to existing bookings → shortest trips → generator cost → permit cost → balanced utilisation. Pure and deterministic. |
| **Constraints** | Truck capacity and diets (vegan, gluten-free, halal), crew-per-day limits with day-type-aware crew mapping, relief crews for long events, pair rules ("never at the same event"), vehicle height vs. clearance, 400 V power or a generator, space per town, locked bookings. |
| **Infeasibility diagnosis** | Constraint families are relaxed one at a time to identify which one blocks the plan, so staff see a reason instead of "no solution". |
| **Pricing engine** (`src/lib/engine/engine.ts`) | Builds the quote line by line: travel zones per truck from its own depot (OSRM road distance, cached), weekend surcharge on food only, permit fees as a pass-through (§10 UStG), 7 % / 19 % VAT. |
| **Data integrity in PostgreSQL** | Triggers reject manual edits to computed fields (totals, VAT, assignments) and to locked system rules. `commit_day_plan` takes a per-date advisory lock and rejects stale plans by snapshot hash, so two planners can't double-book a truck. |
| **Re-planning** | Any change (new booking, fleet edit, blackout, price change) re-runs the solver for future dates. Bookings that no longer fit become *Conflict* with a reason and are never cancelled silently. |
| **Tests** | 44 tests across the pricing engine, rules, solver and depot logic (`bunx vitest run`). |
 
## Tech stack
 
React · TypeScript · TanStack Start · Tailwind CSS · Supabase (PostgreSQL, Auth, RLS, triggers) · Drizzle · OpenStreetMap / OSRM · OpenRouteService (HGV routing) · Vitest
 
## How it was built
 
I built TruckOps with Lovable's AI agent. My part was the work the agent couldn't do on its own:
 
- analysing the client's requirements and turning them into precise business rules
- researching the German legal basis and the real permit fees per town, with sources
- specifying the solver's objective, its constraints and how infeasible cases must be explained
- reviewing every iteration against the requirements, and writing and running the test cases
The full specification below is the working document that drove the build.
 
## Run locally
 
```sh
git clone https://github.com/Amr-Alkhatib/truckops03.git
cd truckops03
bun install        # or: npm install
bun run dev        # or: npm run dev
bunx vitest run    # run the test suite
```
 
The first account that signs up becomes admin automatically (database trigger). Everyone after that is a planner. Admins promote others under **Back office → Users**.
 
---
 
## Full specification
 
### Business rules in force
- **Prices are NET** (B2B). README rule 4 “prices include VAT” (2023, B2C weddings) is superseded — see Back office → Policy notes.
- **Dates** are shown and entered as DD.MM.YYYY everywhere.
- **Contact person + German mobile** (+49/0 then 15x/16x/17x) required on every booking.
- **Big Bertha** needs 400 V; otherwise a generator is charged (generator fee), only where the town allows generators.
- **Computed fields** (totals, VAT, distance, truck assignment, coordinates) are read-only: the `protect_computed_fields` trigger rejects changes unless the engine (`commit_day_plan`) writes them.
- **Sabine's whiteboard** = 6 locked system rules (`pair_rules.is_system`), protected by the `protect_system_rules` trigger. Wurst Case Scenario needs ≥ 3.6 m clearance and an HGV route check (OpenRouteService `driving-hgv`, height 3.6 m) when the `ORS_API_KEY` secret is set; otherwise the booking goes to *Permit check* with “route clearance not verified” until staff confirms.
### Data sources (seeded with source, check date and status)
| Data | Value | Source |
|---|---|---|
| VAT food/catering | 7 % from 01.01.2026 (Steueränderungsgesetz 2025, beverages excluded) | https://www.zdh.de/ueber-uns/fachbereich-steuern-und-finanzen/umsatzsteuer/ermaessigter-umsatzsteuersatz-fuer-die-gastronomie-ab-112026/ · https://www.frankfurt-main.ihk.de/branchenthemen/portal-gastronomie-tourismus-und-gesundheitswirtschaft/wichtige-informationen-zum-gaststaettengewerbe/news-fuer-die-gastronomie/reduzierter-mehrwertsteuersatz-6847546 |
| VAT beverages, travel, generator, crew, fees | 19 % | §12 UStG |
| Permit fees | 0 %, durchlaufender Posten | §10 UStG |
| Stuttgart | SoNuS Anlage 1 (ab 01.01.2026) Nr. 7 b): per started 3 m² per day, groups 1/2/3/S = €44/56/76/113; quoted at S unless staff sets the group. Lead time not published (NULL). | https://www.stuttgart.de/rathaus/verwaltung/stadtrecht/6/6-7-anlage-1-anlage-1-zur-sondernutzungssatzung-gebuehrenverzeichnis-ab-01.01.2026 · https://www.stuttgart.de/medien/ibs/6-7-anlage-1.pdf |
| Esslingen am Neckar | Nr. 12.4: €6 per m² per day, min. €5 (department unverified) | https://www.esslingen.de/site/Esslingen_Layout_2022/get/documents_E384254162/es/Datenquelle-Esslingen-2022/Ortsrecht/1_Sicherheit_Ordnung/1-5_Satzung_Geb%C3%BChren_Sondernutzungen_2024.pdf |
| Ludwigsburg | Fachbereich Sicherheit und Ordnung, Wilhelmstraße 9, 07141 910-2830; fee not published (unknown) | https://ludwigsburg.de/site/Ludwigsburg-Internet-2020/get/params_E1939549931/17995109/Sondernutzungssatzung_Broschuere_2016.pdf |
| BW public holidays | fetched live, filtered to DE-BW | https://date.nager.at/api/v3/PublicHolidays/{year}/DE |
| Legal basis | §§14, 55, 55a GewO; Art. 6 VO (EG) 852/2004; §43 IfSG; §§4, 10, 11 ArbZG; §12 GastG; TA Lärm; Feiertagsgesetz BW | gesetze-im-internet.de / eur-lex |
| Minimum wage | €13.90/h from 01.01.2026, €14.60/h from 01.01.2027 | as given by Rolling Feast (no source URL stored — marked in settings) |
 
Unknown values are stored as NULL and handled explicitly (quote line “to be confirmed”, booking status *Permit check*). Invented placeholder expiry dates from earlier seeds were cleared — staff must enter the real dates.
 
### Truck assignment algorithm (src/lib/engine/solver.ts)
1. **Candidates per booking**: every subset of bookable trucks (active, no blackout, TÜV/registration valid, height ≤ clearance, Bertha only with 400 V or generator allowed, never-assign rules) meeting capacity, diet coverage (vegan > threshold → vegan truck, GF, halal), never-same-event rules (Smokey + Green always allowed), one truck per crew, footprint ≤ space, ≤ town max trucks. Sorted by size, generator cost, permit fee.
2. **Day search**: backtracking, most-constrained booking first, branch & bound on the lexicographic cost (changes to existing bookings, total trucks, generator cost, permit cost, utilisation). Constraints: disjoint trucks, each crew at most once per day (crew mapping is day-type aware: Dough Bros uses Crew Taco on Sat/Sun), relief crews for events > crew max hours ≤ available per day, all day-level rules. Locked bookings (within lock days or with an issued permit) keep their trucks; others may be re-shuffled (audit entry + staff notification).
3. **Infeasible**: constraint families are relaxed one at a time (relief crews, crews/day rules, locks) to name the blocker in plain words; the solver also computes nearest working dates (±14 days), the maximum guests feasible on the date and “shorten to ≤ 6 h”.
4. **Re-plan on change**: new bookings, client approval, staff status changes and any back-office edit (fleet, blackouts, rules, documents, prices, crews) re-run the solver for future dates; bookings that no longer fit become **Conflict** with a reason (never cancelled automatically).
5. **Concurrency**: plans are committed by `commit_day_plan`, which takes `pg_advisory_xact_lock` per event date, rejects stale plans (snapshot hash of the day's assignments → retry) and rebuilds `assignments`, which has a unique index on (truck_id, event_date).
Tests: `bunx vitest run` (engine, rules and solver tests).
 
### Two yards (Neckarperle takeover, from 01.11.2026)
- **Yards** (`yards`): Stuttgart yard (former depot setting, migrated) and Heilbronn yard (49.1427, 9.2109, active from 01.11.2026). Relief crews are set per yard (Stuttgart keeps its count, Heilbronn starts at 0).
- **Truck ↔ yard** (`truck_yard_assignments`, full history): a truck's yard for an event is the assignment valid on the event date. Moves go through Back office → Yards (drag & drop or "Move"), with a preview of affected bookings, then a re-plan of the affected dates.
- **Per-truck distance**: road distance (OSRM driving) from every yard to the venue, cached per venue + yard (`route_cache`) and stored on the booking (`yard_distances`). A truck is only a candidate if its own yard is ≤ the max distance (40 km). Travel is charged per vehicle from its own yard using the travel zones (Espresso Express too, setting "charge travel for add-on vehicles").
- **Solver objective** (lexicographic): all bookings feasible → fewest trucks → fewest changes to existing bookings → shortest total trip km → generator → permit cost → balanced utilisation. Confirmed bookings keep their stored prices when trucks are re-assigned.
- **New trucks**: Kebabylon (halal) and Spätzle Shuttle (vegetarian, not vegan — the vegetarian flag never counts for the vegan rule), available from 01.11.2026, own crews.
- **Onboarding** (Compliance → Heilbronn onboarding): branch Gewerbeanmeldung (§14 GewO) at Stadt Heilbronn; food business registration of both trucks under Rolling Feast (Art. 6 VO (EG) 852/2004, at the head-office authority, Stuttgart); keeper change, insurance, TÜV per truck; §43 IfSG certificates per new crew member; Neckarperle permits are personal and not reusable; §613a BGB staff transfer note. Open required items mark the truck "onboarding": it can be quoted, but bookings go to Permit check and can't be confirmed (DB trigger).
- **Heilbronn permits**: Satzung über Sondernutzungen an öffentlichen Straßen (6/3), Nr. 2.2: per started m² per day up to €5.00 (min. €5); quoted at the maximum as "max. estimate, final per Gebührenbescheid"; status unverified → Permit check. Source: https://www.heilbronn.de/fileadmin/daten/stadtheilbronn/formulare/rathaus/stadtrecht/6_Bau-_und_Wohnungswesen/6_3_Satzung_ueber_Sondernutzungen_an_oeffentlichen_Strassen.pdf (overview https://www.heilbronn.de/rathaus/stadtrecht.html). Other towns in Landkreis Heilbronn are auto-created as unverified.
- Tests: `src/lib/engine/yards.test.ts`.
