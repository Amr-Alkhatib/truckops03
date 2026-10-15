import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAddress, type GeoResult } from "@/lib/geo";

export function AddressAutocomplete({ value, onSelect, onType }: { value: string; onSelect: (r: GeoResult) => void; onType: (v: string) => void }) {
  const [q, setQ] = useState(value);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const picked = useRef(value);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    if (q.length < 4 || q === picked.current) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchAddress(q, ctrl.signal));
        setOpen(true);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder="Start typing the venue address…" value={q} onChange={(e) => { setQ(e.target.value); onType(e.target.value); }} onFocus={() => results.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && results.length > 0 && (
        <ul className="glass absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl p-1 text-sm">
          {results.map((r) => (
            <li key={`${r.label}-${i}`}>
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-accent" onMouseDown={() => { picked.current = r.label; setQ(r.label); setOpen(false); onSelect(r); }}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Address data © OpenStreetMap contributors</p>
    </div>
  );
}
