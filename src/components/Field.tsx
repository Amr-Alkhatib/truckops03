import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function YesNo({ value, onChange, yes = "Yes", no = "No" }: { value: boolean | null; onChange: (v: boolean) => void; yes?: string; no?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[true, false].map((v) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${value === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
          {v ? yes : no}
        </button>
      ))}
    </div>
  );
}
