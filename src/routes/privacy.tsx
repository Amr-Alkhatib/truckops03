import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { PrivacyPolicy, PRIVACY_UPDATED } from "@/components/PrivacyPolicy";
import { getPrivacyContact } from "@/lib/legal.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — TruckOps" },
      { name: "description", content: "What TruckOps stores, why, and which services are involved." },
    ],
  }),
  loader: () => getPrivacyContact(),
  component: Privacy,
});

function Privacy() {
  const { email } = Route.useLoaderData();
  const { lang, t } = useI18n();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t("Privacy policy")}</h1>
        <p className="mt-2 text-muted-foreground">{t("What TruckOps stores, why, and who else is involved.")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("Last updated")}: {PRIVACY_UPDATED}</p>
        <div className="text-[15px] leading-7 text-muted-foreground">
          <PrivacyPolicy lang={lang} email={email} />
        </div>
      </main>
    </div>
  );
}
