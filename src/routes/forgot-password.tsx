import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — TruckOps" },
      { name: "description", content: "Get a link to reset your TruckOps password." },
      { property: "og:title", content: "Forgot password — TruckOps" },
      { property: "og:description", content: "Reset your Rolling Feast TruckOps password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };
  if (sent)
    return (
      <AuthCard title="Check your inbox" subtitle={`If an account exists for ${email}, we sent a link to reset your password.`}>
        <Button asChild variant="hero" className="w-full"><Link to="/login">Back to sign in</Link></Button>
      </AuthCard>
    );
  return (
    <AuthCard title="Forgot your password?" subtitle="We'll email you a link to choose a new one.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground"><Link to="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </AuthCard>
  );
}
