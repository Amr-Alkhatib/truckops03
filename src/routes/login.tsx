import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckInbox } from "./signup";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — TruckOps" },
      { name: "description", content: "Sign in to book and manage your Rolling Feast events." },
      { property: "og:title", content: "Sign in — TruckOps" },
      { property: "og:description", content: "Planner and back-office sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  if (unconfirmed) return <CheckInbox email={email} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        toast.error("Please confirm your email first — we can send the link again.");
        setUnconfirmed(true);
        return;
      }
      return toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
    }
    toast.success("Welcome back");
    const safe = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/bookings";
    navigate({ to: safe as "/bookings" });
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to plan your next event.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        <p className="text-right text-sm"><Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link></p>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here? <Link to="/signup" className="text-primary hover:underline">Create an account</Link>
      </p>
    </AuthCard>
  );
}
