import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirming your account — TruckOps" },
      { name: "description", content: "Completing sign-in for Rolling Feast TruckOps." },
      { property: "og:title", content: "Confirming your account — TruckOps" },
      { property: "og:description", content: "Completing sign-in for Rolling Feast TruckOps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Callback,
});

function friendly(code: string | null, desc: string | null) {
  const d = (desc ?? "").toLowerCase();
  if (code === "otp_expired" || d.includes("expired")) return "This link has expired. Links are valid for a limited time — request a new one below.";
  if (d.includes("invalid") || d.includes("not found") || code === "bad_code_verifier") return "This link is invalid or was already used. If you already confirmed, just sign in.";
  return desc || "We couldn't complete sign-in with this link.";
}

function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errCode = url.searchParams.get("error_code") ?? hash.get("error_code");
      const errDesc = url.searchParams.get("error_description") ?? hash.get("error_description");
      if (errCode || errDesc || url.searchParams.get("error") || hash.get("error")) return setError(friendly(errCode, errDesc));
      const type = url.searchParams.get("type") ?? hash.get("type");
      try {
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            // the client may already have exchanged it automatically
            const { data } = await supabase.auth.getSession();
            if (!data.session) return setError(friendly(error.code ?? null, error.message));
          }
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await supabase.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
          if (error) return setError(friendly(error.code ?? null, error.message));
        } else if (url.searchParams.get("token_hash")) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: url.searchParams.get("token_hash")!, type: (type as any) ?? "signup" });
          if (error) return setError(friendly(error.code ?? null, error.message));
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) return setError("We couldn't complete sign-in with this link. It may have expired or already been used.");
        window.history.replaceState(null, "", "/auth/callback");
        navigate({ to: type === "recovery" ? "/reset-password" : "/profile", replace: true });
      } catch (e: any) {
        setError(friendly(null, e?.message ?? null));
      }
    })();
  }, [navigate]);

  if (error)
    return (
      <AuthCard title="Link problem" subtitle={error}>
        <div className="space-y-3">
          <Button asChild variant="hero" className="w-full"><Link to="/login">Sign in / resend confirmation</Link></Button>
          <Button asChild variant="outline" className="w-full"><Link to="/forgot-password">Reset my password</Link></Button>
        </div>
      </AuthCard>
    );
  return <AuthCard title="Confirming…" subtitle="One moment while we sign you in."><div className="h-2 w-full animate-pulse rounded bg-accent" /></AuthCard>;
}
