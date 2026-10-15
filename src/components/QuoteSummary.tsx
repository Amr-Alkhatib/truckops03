import { useI18n } from "@/lib/i18n";
import { AlertTriangle, Ban, CheckCircle2, Info, Truck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { eur, type Quote } from "@/lib/engine";
import { Skeleton } from "@/components/ui/skeleton";

export function QuoteSummary({ quote, loading, compact }: { quote: Quote | null; loading?: boolean; compact?: boolean }) {
  const { t } = useI18n();
  if (loading || !quote)
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-8 w-40" />
      </div>
    );
  return (
    <div className="space-y-4 text-sm">
      <AnimatePresence>
        {quote.blockers.map((b) => (
          <motion.div key={b.code + b.message} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
            <p className="flex gap-2 font-medium text-destructive"><Ban className="mt-0.5 size-4 shrink-0" />{b.message}</p>
            {b.hint && <p className="mt-1 pl-6 text-foreground/80">{b.hint}</p>}
          </motion.div>
        ))}
      </AnimatePresence>
      {quote.suggestions?.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-1 font-medium">{t("What would work")}</p>
          <ul className="list-disc space-y-0.5 pl-5">{quote.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {quote.permitCheck && (
        <div className="rounded-xl bg-warning/15 p-3">
          <p className="flex gap-2 font-medium"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{t("Permit check before confirmation")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-10 text-foreground/80">{quote.permitReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {quote.warnings.map((w) => (
        <p key={w.code} className="flex gap-2 rounded-xl bg-warning/15 p-3 text-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{w.message}</p>
      ))}

      {quote.trucks.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{t("Your trucks")}</p>
          <div className="flex flex-wrap gap-2">
            {quote.trucks.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium"><Truck className="size-3" />{t.name} · {t.cuisine}{t.vegan ? " · vegan" : t.vegetarian ? " · vegetarian" : ""}</span>
            ))}
            {quote.espressoTruckId && <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium">☕ Espresso Express</span>}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {quote.lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{l.label} <span className="text-xs opacity-70">({l.vatRate}%)</span></span>
            <span className="tabular-nums">{l.tbc ? t("to be confirmed") : eur(l.net)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t pt-3">
        <div className="flex justify-between"><span>{t("Total net")}</span><span className="tabular-nums">{eur(quote.totalNet)}</span></div>
        {quote.vat.map((g) => (
          <div key={g.rate} className="flex justify-between text-muted-foreground">
            <span>VAT {g.rate}% on {eur(g.net)}</span><span className="tabular-nums">{eur(g.vat)}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between pt-2">
          <span className="font-semibold">{t("Total gross")}</span>
          <motion.span key={quote.totalGross} initial={{ scale: 1.08 }} animate={{ scale: 1 }} className="font-display text-2xl font-semibold tabular-nums">{eur(quote.totalGross)}</motion.span>
        </div>
      </div>
      {!compact && quote.notes.map((n) => <p key={n} className="flex gap-2 text-xs text-muted-foreground"><Info className="size-3.5 shrink-0" />{n}</p>)}
      {quote.ok && (
        <p className="flex gap-2 text-xs text-success"><CheckCircle2 className="size-3.5" />{quote.needsApproval ? t("Needs a second approver at your company") : t("Ready to book")}</p>
      )}
      {!compact && quote.excluded.length > 0 && !quote.ok && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{t("Why some trucks can't come")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">{quote.excluded.map((e) => <li key={e.name}>{e.reason}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
