import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/** Text input that shows and accepts dates as DD.MM.YYYY; emits ISO (YYYY-MM-DD) or "". */
export function DateInputDE({ value, onChange, id }: { value: string | null | undefined; onChange: (iso: string) => void; id?: string }) {
  const toDE = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "");
  const [text, setText] = useState(toDE(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(toDE(value)), [value]);
  const commit = (t: string) => {
    if (!t.trim()) { setBad(false); return onChange(""); }
    const m = t.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return setBad(true);
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return setBad(true);
    setBad(false);
    onChange(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  };
  return (
    <div>
      <Input id={id} inputMode="numeric" placeholder="TT.MM.JJJJ" value={text} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} aria-invalid={bad} />
      {bad && <p className="mt-1 text-xs text-destructive">Use the format DD.MM.YYYY</p>}
    </div>
  );
}
