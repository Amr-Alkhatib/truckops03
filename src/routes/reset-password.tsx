import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — TruckOps" },
      { name: "description", content: "Set a new password for your TruckOps account." },
      { property: "og:title", content: "Choose a new password — TruckOps" },
      { property: "og:description", content: "Set a new password for your Rolling Feast TruckOps account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error_description")) {
      setReady(false);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code).catch(() => null);
      const { data } = await supabase.auth.getSession();
      setReady((r) => r ?? !!data.session);
      if (!data.session) setTimeout(() => setReady((r) => r ?? false), 1500);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    if (pw !== pw2) return toast.error("The passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/profile" });
  };

  if (ready === false)
    return (
      <AuthCard title="Link expired or invalid" subtitle="This reset link can't be used any more. Request a new one.">
        <Button asChild variant="hero" className="w-full"><Link to="/forgot-password">Send a new reset link</Link></Button>
      </AuthCard>
    );
  return (
    <AuthCard title="Choose a new password" subtitle="At least 8 characters.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={!ready} /></div>
        <div className="space-y-1.5"><Label htmlFor="pw2">Repeat password</Label><Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} disabled={!ready} /></div>
        <Button type="submit" variant="hero" className="w-full" disabled={busy || !ready}>{busy ? "Saving…" : "Save new password"}</Button>
      </form>
    </AuthCard>
  );
}
