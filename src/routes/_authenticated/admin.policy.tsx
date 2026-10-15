import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/policy")({
  head: () => ({ meta: [{ title: "Policy notes — TruckOps back office" }, { name: "description", content: "Why TruckOps works the way it does." }] }),
  component: Policy,
});

const NOTES = [
  {
    title: "README rule 4 “prices include VAT” — SUPERSEDED",
    body: [
      "This rule dates from 2023, when our clients were private weddings. Consumers (B2C) must be shown gross prices (Preisangabenverordnung), so prices were quoted including VAT.",
      "Today our clients are companies (B2B). Marco's current rules state that prices are NET for corporate clients. TruckOps therefore shows every price net, with VAT added per category on the quote (food 7 %, beverages and fees 19 %, permits 0 % pass-through) and the gross total shown last.",
      "Decision: keep prices net. If B2C events return, this note must be revisited before quoting private clients.",
    ],
  },
  { title: "README rule 1 — dates", body: ["Every date is shown and entered as DD.MM.YYYY: forms, tables, PDF quotes and messages."] },
  { title: "README rule 2 — contact person", body: ["Every booking needs a client contact person with a German mobile number (+49 / 0 followed by 15x, 16x or 17x). The field is required."] },
  { title: "README rule 3 — Big Bertha", body: ["Big Bertha needs 400 V. Without 400 V we bring a generator and charge the generator fee (€150) — only where the town allows generators; otherwise Big Bertha is excluded."] },
  { title: "README rule 5 — computed fields", body: ["Totals, VAT, distance, zone and truck assignment are read-only for everyone, including staff. A database trigger rejects any change that doesn't come from the pricing engine."] },
  { title: "Sabine's whiteboard (Exhibit 2)", body: ["The six whiteboard rules are stored as locked system rules. The database refuses edits, disabling or deletion, and both the live quote and the server check enforce them."] },
];

function Policy() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Policy notes</h1>
      {NOTES.map((n) => (
        <section key={n.title} className="glass rounded-3xl p-6">
          <h2 className="mb-2 text-lg font-semibold">{n.title}</h2>
          {n.body.map((p) => <p key={p} className="mb-2 text-sm text-muted-foreground last:mb-0">{p}</p>)}
        </section>
      ))}
    </div>
  );
}
