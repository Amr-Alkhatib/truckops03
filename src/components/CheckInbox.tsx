import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function CheckInbox({ email }: { email: string }) {
  const { t } = useI18n();
  const [cooldown, setCooldown] = useState(60);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  const resend = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) return toast.error(error.message);
    toast.success(t("Confirmation email sent again"));
    setCooldown(60);
  };
  return (
    <AuthCard title={t("Check your inbox")} subtitle={t("We sent a confirmation link to {email}.", { email })}>
      <p className="text-sm text-muted-foreground">{t("Click the link in the email to activate your account — you'll land on your profile, signed in. Check your spam folder if nothing arrives within a few minutes.")}</p>
      <Button variant="outline" className="mt-6 w-full" disabled={cooldown > 0} onClick={resend}>
        {cooldown > 0 ? t("Resend confirmation email ({s} s)", { s: cooldown }) : t("Resend confirmation email")}
      </Button>
      <Button asChild variant="hero" className="mt-3 w-full"><Link to="/login">{t("Go to sign in")}</Link></Button>
    </AuthCard>
  );
}
