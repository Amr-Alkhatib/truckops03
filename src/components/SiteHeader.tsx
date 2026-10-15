import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Truck } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { LangSwitch } from "./LangSwitch";
import { useI18n } from "@/lib/i18n";

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const links = user ? (
    <>
      <Link to="/book" className="hover:text-primary" activeProps={{ className: "text-primary" }}>{t("New booking")}</Link>
      <Link to="/bookings" className="hover:text-primary" activeProps={{ className: "text-primary" }}>{t("My bookings")}</Link>
      <Link to="/profile" className="hover:text-primary" activeProps={{ className: "text-primary" }}>{t("Profile & places")}</Link>
      {isStaff && <Link to="/admin" className="hover:text-primary" activeProps={{ className: "text-primary" }}>{t("Back office")}</Link>}
    </>
  ) : null;

  return (
    <header className={overlay ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 glass border-x-0 border-t-0 rounded-none"}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
            <Truck className="size-4" />
          </span>
          <span className={`font-display text-lg font-semibold ${overlay ? "text-ink-foreground" : ""}`}>
            TruckOps <span className="hidden font-sans text-xs font-normal opacity-60 sm:inline">by Rolling Feast</span>
          </span>
        </Link>
        <nav className={`hidden flex-1 items-center gap-6 text-sm font-medium md:flex ${overlay ? "text-ink-foreground" : ""}`}>{links}</nav>
        <div className="ml-auto flex items-center gap-2">
          <LangSwitch />
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex">
              <LogOut /> {t("Sign out")}
            </Button>
          ) : (
            <>
              <Button asChild variant={overlay ? "glass" : "ghost"} size="sm"><Link to="/login">Sign in</Link></Button>
              <Button asChild variant="hero" size="sm"><Link to="/signup">Get started</Link></Button>
            </>
          )}
          {user && (
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
              <Menu />
            </Button>
          )}
        </div>
      </div>
      {open && user && (
        <nav className="glass mx-4 mb-3 flex flex-col gap-3 rounded-xl p-4 text-sm font-medium md:hidden" onClick={() => setOpen(false)}>
          {links}
          <button onClick={signOut} className="text-left text-muted-foreground">{t("Sign out")}</button>
        </nav>
      )}
    </header>
  );
}
