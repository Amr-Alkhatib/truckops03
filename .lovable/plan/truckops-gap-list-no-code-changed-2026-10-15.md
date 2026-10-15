# TruckOps gap list (no code changed)

Legend: Done / Partly / Missing / Different.

## 1. Architecture
| Requirement | Status | Where it lives | What would need to change |
|---|---|---|---|
| Prices, VAT, thresholds editable in admin | Done | settings table, VAT rates table; Pricing page | — |
| Trucks and truck rules in DB, admin-edited | Done | trucks, blackouts, pair rules tables; Fleet and Rules pages | — |
| Town permit profiles in DB | Done | towns table; Towns page | — |
| Packages in DB | Partly | one Afterwork package stored inside settings | Add a packages table plus an admin page; the booking wizard reads from it |
| One server-side quote function for quote screen and booking | Different | same engine code runs in the browser for the live quote and again on the server at submit | Add a server "get quote" call and use it on the quote screen; the browser copy then only shows results |
| Block reasons as codes plus parameters | Partly | each block has a code, but the wording is baked into the English message; a params field exists but is mostly unused | Fill params for every block; build the message from code plus params at display time (also needed for German) |
| Prices net, VAT 7/19/19/0 | Done | VAT rates by event date | — |
| Planners and approvers use token links without accounts | Different | approvers use a token link (done); planners must have an account | Add a planner token link (e.g. emailed magic link per booking or per company). Large change to access rules |
| German and English with a switch | Missing | all text is English only | Add translations for every screen, the PDF and messages. Large change (touches every page) |

## 2. Pricing
| Requirement | Status | Where | Change |
|---|---|---|---|
| €14 per guest, €1,200 minimum per truck | Done | settings + engine | — |
| Weekend +20% on food only, after the minimum | Partly | engine applies surcharge after the minimum, but settings currently apply it to food AND crew | Set the setting to food only (settings change, no code) |
| Espresso €350, never alone | Done | engine | — |
| Travel once per event, zones 40/80/120, >40 km blocked, live routing | Done | settings zones; road distance from live routing | — |
| Big Bertha generator €150 only if town allows, else excluded | Done | engine | — |
| Permit fee flat / per vehicle / per m² | Done (extended) | towns fee model, also per started 3 m² for Stuttgart | — |

## 3. Trucks
| Requirement | Status | Where | Change |
|---|---|---|---|
| Max 100 guests, fewest trucks | Done | solver | — |
| Vegan >15%, any GF / halal covered | Done | solver | — |
| Extra truck for diet needs, explained | Partly | solver adds it, but the quote doesn't say why | Add a note "1 extra truck added because …" when the diet-driven pick is bigger than the guest-count pick |
| Planner can swap among valid options | Missing | trucks are only chosen automatically | Show the valid alternatives from the solver and let the planner pick; server re-checks the pick at booking |

## 4. Blocks
| Requirement | Status | Where | Change |
|---|---|---|---|
| Event longer than 6 h blocked (Afterwork 17:00–23:30 blocked) | Different | currently allowed with a second crew fee (setting "allow longer events" is ON) | Turn that setting off (settings change). Then the Afterwork package can never be booked, so the package needs a new time or should be flagged |
| Over 40 km | Done | engine | — |
| Truck already booked that day | Done | assignments + solver (may move other unlocked bookings instead of blocking) | Optional: turn off re-shuffling if a strict block is wanted |
| Pho Real January, Nonna retired | Done | blackouts, truck status | — |
| Taco + Salsa same day, weekend one of three, Green + Wurst | Done | locked system rules | — |
| Truck taller than clearance | Done | engine | — |
| Public space: town profile incomplete / too little notice / ends too late | Different | incomplete profile and late end currently go to "Permit check" or a warning instead of a block; short notice blocks | Change to hard blocks with a setting per town; conflicts with the earlier "Permit check" request, so decide which wins |

## 5. Booking
| Requirement | Status | Where | Change |
|---|---|---|---|
| Company, billing address, PO required | Done | booking form + server check | — |
| Over €4,000 net → approver name and email | Done | settings threshold | — |
| "Awaiting client approval" until accept/reject via token link shown on screen | Done | approval page | — |
| Approval link emailed | Missing | link is only shown on screen | Set up app emails and send the link on booking |
| Booking re-checks availability | Done | server re-plans the day under a lock at submit | — |

## 6. Team area
| Requirement | Status | Where | Change |
|---|---|---|---|
| Settings, travel zones, trucks + blackouts, rules, towns | Done | admin pages | — |
| Packages admin | Missing | see 1 | packages table + page |
| Change log of every admin edit | Missing | only booking status history exists | Add a change log table filled by database triggers on all admin tables, plus a log page |
| Bookings list, dispatch calendar | Done | Bookings, Calendar pages | — |
| Printable quote with VAT split using saved prices | Done | PDF built from the saved quote | — |

## Proposed order (lowest risk first)
1. Settings-only fixes: weekend surcharge on food only; turn off long events (decide what happens to the Afterwork preset first).
2. "Extra truck added because …" note on the quote.
3. Change log: new table + triggers + read-only page (new, isolated).
4. Packages table + admin page; wizard reads packages.
5. Approval email (needs email setup on a sender domain).
6. Block codes with parameters throughout the engine (medium; groundwork for German).
7. Public-space blocks vs "Permit check" — needs your decision first.
8. Server quote function used by the quote screen (medium; keeps browser copy for instant feedback).
9. Planner truck swap among valid options (medium-large).
10. German/English switch — big rewrite of all text.
11. Planners via token links without accounts — big rewrite of access and security rules.

## Decisions needed
- Long events: block always (as in this list) or keep the second-crew option from the earlier brief? If blocked, what is the new Afterwork time?
- Incomplete town profile / late end on public ground: hard block (this list) or "Permit check" (earlier brief)?
- Planner access: replace accounts with token links, or add token links alongside accounts?
