import { useI18n, useRestoreLang } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Home, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  useRestoreLang();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 pb-24 pt-16 text-center sm:pt-24">
        <p className="font-display text-[7rem] font-semibold leading-none tracking-tight text-gradient sm:text-[10rem]" aria-hidden="true">404</p>
        {/* A truck rolling along a dashed road; it stays still for reduced motion. */}
        <div className="relative mt-4 h-14 w-full max-w-md overflow-hidden" aria-hidden="true">
          <div className="absolute inset-x-0 bottom-3 h-0.5 bg-[repeating-linear-gradient(90deg,var(--color-border)_0_18px,transparent_18px_30px)]" />
          <motion.span
            className="absolute bottom-4 grid size-10 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant"
            initial={{ left: "-12%" }}
            animate={reduceMotion ? { left: "45%" } : { left: ["-12%", "45%", "45%", "112%"] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 5, times: [0, 0.35, 0.65, 1], repeat: Infinity, ease: "easeInOut" }}
          >
            <Truck className="size-5" />
          </motion.span>
        </div>
        <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">{t("This truck took a wrong turn")}</h1>
        <p className="mt-3 max-w-md text-muted-foreground">{t("The page you're looking for doesn't exist or has moved. Let's get you back on the road.")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="inline-flex h-11 items-center gap-2 rounded-full border bg-background px-5 text-sm font-medium hover:bg-accent"><Home className="size-4" /> {t("Back to the start page")}</Link>
          <Link to="/book" className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-primary px-5 text-sm font-semibold text-primary-foreground shadow-elegant">{t("Get an instant quote")} <ArrowRight className="size-4" /></Link>
        </div>
      </main>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const { t } = useI18n();
  useRestoreLang();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("This page didn't load")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("Something went wrong on our end. You can try refreshing or head back home.")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {t("Try again")}
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">{t("Go home")}</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TruckOps — Rolling Feast Event Catering" },
      { name: "description", content: "Book corporate food-truck catering in Stuttgart and Baden-Württemberg with instant, transparent quotes." },
      { property: "og:title", content: "TruckOps — Rolling Feast Event Catering" },
      { property: "og:description", content: "Instant quotes for corporate food-truck catering around Stuttgart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useRestoreLang();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <SiteFooter />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
