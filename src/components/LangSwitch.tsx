import { useI18n } from "@/lib/i18n";

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex rounded-full border p-0.5 text-xs font-semibold" role="group" aria-label="Language">
      {(["de", "en"] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-full px-2 py-1 uppercase ${lang === l ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
      ))}
    </div>
  );
}
