import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

/** Shown under every page so the privacy policy is always one click away. */
export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t py-8 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 sm:px-6">
        <span>© {new Date().getFullYear()} Rolling Feast Event Catering · {t("TruckOps demo")}</span>
        <Link to="/privacy" className="font-medium underline-offset-4 hover:text-foreground hover:underline">{t("Privacy")}</Link>
      </div>
    </footer>
  );
}
