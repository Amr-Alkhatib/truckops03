import { useI18n, type Vars } from "@/lib/i18n";

/** Translated text for places without a hook in scope, e.g. `<h1><T>Fleet</T></h1>`. */
export function T({ children, vars }: { children: string; vars?: Vars }) {
  const { t } = useI18n();
  return <>{t(children, vars)}</>;
}
