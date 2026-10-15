import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckInbox } from "@/components/CheckInbox";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — TruckOps" },
      { name: "description", content: "Create a planner account to book Rolling Feast food trucks." },
      { property: "og:title", content: "Create account — TruckOps" },
      { property: "og:description", content: "Sign up to get instant food-truck catering quotes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Signup,
});

function Signup() {
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: r.data.email,
      password: r.data.password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { full_name: r.data.full_name } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  if (sent) return <CheckInbox email={form.email} />;

  return (
    <AuthCard title="Create your planner account" subtitle="Book trucks, save your venues, track approvals.">
      <form onSubmit={submit} className="space-y-4">
        {(["full_name", "email", "password"] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={k}>{k === "full_name" ? "Full name" : k === "email" ? "Work email" : "Password"}</Label>
            <Input id={k} type={k === "password" ? "password" : k === "email" ? "email" : "text"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
          </div>
        ))}
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
      </p>
    </AuthCard>
  );
}

