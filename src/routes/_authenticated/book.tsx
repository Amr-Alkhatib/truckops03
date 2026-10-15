import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CalendarIcon, Check, ChevronLeft, ChevronRight, Copy, Download, Sparkles, Bookmark } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, YesNo } from "@/components/Field";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { QuoteSummary } from "@/components/QuoteSummary";
import { RouteMap } from "@/components/RouteMap";
import { useDateData, useRoute, useStaticData } from "@/hooks/use-engine";
import { bookingSchema } from "@/lib/booking-schema";
import { submitBooking, type SubmitResult } from "@/lib/booking.functions";
import { buildQuote, eur, formatDateDE } from "@/lib/engine";
import { makeContext as _m } from "@/lib/data";
import { downloadQuotePdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/book")({
  validateSearch: z.object({ package: z.enum(["afterwork", "custom"]).optional() }),
  head: () => ({ meta: [{ title: "New booking — TruckOps" }, { name: "description", content: "Book Rolling Feast food trucks with a live quote." }] }),
  component: BookWizard,
});

type Form = {
  package: "afterwork" | "custom" | "";
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  address: string;
  town: string;
  lat: number | null;
  lon: number | null;
  venue_type: "public_ground" | "private_campus" | "";
  has_400v: boolean | null;
  no_clearance_limit: boolean;
  clearance_m: string;
  space_m2: string;
  guests: string;
  vegan: string;
  gluten_free: string;
  halal: string;
  espresso: boolean;
  company_name: string;
  billing_address: string;
  po_number: string;
  contact_name: string;
  contact_mobile: string;
  approver_name: string;
  approver_email: string;
};

const EMPTY: Form = {
  package: "", event_date: "", start_time: "", end_time: "", venue_name: "", address: "", town: "", lat: null, lon: null,
  venue_type: "", has_400v: null, no_clearance_limit: false, clearance_m: "", space_m2: "", guests: "", vegan: "0", gluten_free: "0", halal: "0",
  espresso: false, company_name: "", billing_address: "", po_number: "", contact_name: "", contact_mobile: "", approver_name: "", approver_email: "",
};

const STEPS = ["Package", "Date & time", "Venue", "Guests & diet", "Add-ons", "Company", "Review"];
const STEP_FIELDS: string[][] = [
  ["package"],
  ["event_date", "start_time", "end_time"],
  ["venue_name", "address", "town", "lat", "lon", "venue_type", "has_400v", "clearance_m", "space_m2"],
  ["guests", "vegan", "gluten_free", "halal"],
  ["espresso"],
  ["company_name", "billing_address", "po_number", "contact_name", "contact_mobile", "approver_name", "approver_email"],
  [],
];

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

function toPayload(f: Form) {
  return {
    ...f,
    package: f.package || undefined,
    venue_type: f.venue_type || undefined,
    has_400v: f.has_400v ?? undefined,
    lat: f.lat ?? undefined,
    lon: f.lon ?? undefined,
    clearance_m: f.no_clearance_limit ? null : isNaN(num(f.clearance_m)) ? undefined : num(f.clearance_m),
    space_m2: isNaN(num(f.space_m2)) ? undefined : num(f.space_m2),
    guests: isNaN(num(f.guests)) ? undefined : num(f.guests),
    vegan: isNaN(num(f.vegan)) ? undefined : num(f.vegan),
    gluten_free: isNaN(num(f.gluten_free)) ? undefined : num(f.gluten_free),
    halal: isNaN(num(f.halal)) ? undefined : num(f.halal),
  };
}

function BookWizard() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const submit = useServerFn(submitBooking);

  const staticQ = useStaticData();
  const cfg = staticQ.data?.config;
  const dateQ = useDateData(f.event_date || null);
  const dest = f.lat != null && f.lon != null ? { lat: f.lat, lon: f.lon } : null;
  const routeQ = useRoute(cfg?.depot, dest);

  const profileQ = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user!.id).single();
      return data;
    },
  });
  const presetsQ = useQuery({
    queryKey: ["presets"],
    queryFn: async () => (await supabase.from("event_presets").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  // Prefill company details from profile
  useEffect(() => {
    const p = profileQ.data;
    if (!p) return;
    setF((x) => ({
      ...x,
      company_name: x.company_name || p.company_name,
      billing_address: x.billing_address || p.billing_address,
      contact_name: x.contact_name || p.full_name,
      contact_mobile: x.contact_mobile || p.phone,
    }));
  }, [profileQ.data]);

  const choosePackage = (p: "afterwork" | "custom") => {
    if (p === "afterwork" && cfg) setF((x) => ({ ...x, package: p, start_time: cfg.afterwork_package.start, end_time: cfg.afterwork_package.end }));
    else set("package", p);
  };
  useEffect(() => {
    if (search.package && cfg && !f.package) choosePackage(search.package);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.package, cfg]);

  // Live quote via the pure engine
  const quote = useMemo(() => {
    if (!staticQ.data || !dateQ.data || !routeQ.data) return null;
    const p = toPayload(f);
    return buildQuote(
      {
        package: f.package || "custom",
        event_date: f.event_date,
        start_time: f.start_time || "12:00",
        end_time: f.end_time || "16:00",
        venue_type: (f.venue_type || "private_campus") as any,
        town: f.town,
        has_400v: f.has_400v ?? true,
        clearance_m: p.clearance_m ?? null,
        space_m2: p.space_m2 ?? 9999,
        guests: p.guests ?? 1,
        vegan: p.vegan ?? 0,
        gluten_free: p.gluten_free ?? 0,
        halal: p.halal ?? 0,
        espresso: f.espresso,
        distance_km: routeQ.data.km,
      },
      _m(staticQ.data, dateQ.data),
    );
  }, [f, staticQ.data, dateQ.data, routeQ.data]);

  const validate = (fields: string[] | null) => {
    const r = bookingSchema.safeParse(toPayload(f));
    const errs: Record<string, string> = {};
    if (!r.success)
      for (const i of r.error.issues) {
        const k = String(i.path[0]);
        if ((!fields || fields.includes(k)) && !errs[k]) errs[k] = i.message.startsWith("Required") || i.message.startsWith("Expected") ? "This field is required" : i.message;
      }
    if ((!fields || fields.includes("end_time")) && f.start_time && f.end_time && f.start_time === f.end_time) errs.end_time = "End time must differ from start time";
    if ((!fields || fields.includes("lat")) && (f.lat == null)) errs.address = "Pick an address from the suggestions so we can measure the road distance";
    if ((!fields || fields.includes("clearance_m")) && !f.no_clearance_limit && f.clearance_m === "") errs.clearance_m = "Enter the clearance or tick 'no height limit'";
    if ((!fields || fields.includes("approver_name")) && quote?.needsApproval) {
      if (!f.approver_name.trim()) errs.approver_name = "Orders above the approval threshold need a second approver";
      if (!f.approver_email.trim()) errs.approver_email = "Approver email is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate(STEP_FIELDS[step])) return toast.error("Please complete the highlighted fields");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const doSubmit = async () => {
    if (!validate(null)) return toast.error("Some details are missing — please check each step");
    setSubmitting(true);
    try {
      const res = await submit({ data: toPayload(f) as any });
      setResult(res);
      if (res.ok) {
        toast.success(res.status === "confirmed" ? "Booking confirmed!" : "Sent for client approval");
        qc.invalidateQueries({ queryKey: ["my-bookings"] });
      } else if (res.leadCreated) toast.info("Our team will contact you about this location");
      else toast.error(res.error ?? "This booking can't be processed yet");
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (p: any) => {
    setF((x) => ({
      ...x,
      venue_name: p.venue_name, address: p.address, town: p.town, lat: p.lat, lon: p.lon, venue_type: p.venue_type, has_400v: p.has_400v,
      no_clearance_limit: p.clearance_m == null, clearance_m: p.clearance_m == null ? "" : String(p.clearance_m), space_m2: String(p.space_m2),
      start_time: x.package === "afterwork" ? x.start_time : p.start_time.slice(0, 5), end_time: x.package === "afterwork" ? x.end_time : p.end_time.slice(0, 5),
      guests: String(p.guests), vegan: String(p.vegan), gluten_free: String(p.gluten_free), halal: String(p.halal),
    }));
    toast.success(`Loaded “${p.label}”`);
  };

  if (result?.ok) return <SuccessView result={result} form={f} />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Book your food trucks</h1>
          <p className="text-muted-foreground">Every detail is required — your quote updates live.</p>
        </div>
        {presetsQ.data && presetsQ.data.length > 0 && (
          <Popover>
            <PopoverTrigger asChild><Button variant="glass"><Bookmark /> Use a saved place</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-2">
              {presetsQ.data.map((p) => (
                <button key={p.id} className="w-full rounded-lg p-3 text-left hover:bg-accent" onClick={() => applyPreset(p)}>
                  <p className="font-medium">{p.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.venue_name} · {p.guests} guests</p>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <ol className="mb-6 flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i < step && setStep(i)} className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${i === step ? "bg-gradient-primary text-primary-foreground" : i < step ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>
              <span className="grid size-5 place-items-center rounded-full bg-background/30">{i < step ? <Check className="size-3" /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="glass rounded-3xl p-5 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="space-y-5">
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <button type="button" onClick={() => choosePackage("afterwork")} className={`relative rounded-2xl border p-6 text-left transition-all ${f.package === "afterwork" ? "border-primary shadow-elegant" : "hover:border-primary/50"}`}>
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-gradient-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground"><Sparkles className="size-3" />Best-seller</span>
                    <h3 className="text-2xl font-semibold">{cfg?.afterwork_package.name ?? "Afterwork Party"}</h3>
                    <p className="mt-1 text-muted-foreground">{cfg?.afterwork_package.start}–{cfg?.afterwork_package.end} · one click</p>
                  </button>
                  <button type="button" onClick={() => choosePackage("custom")} className={`rounded-2xl border p-6 text-left transition-all ${f.package === "custom" ? "border-primary shadow-elegant" : "hover:border-primary/50"}`}>
                    <h3 className="text-2xl font-semibold">Custom event</h3>
                    <p className="mt-1 text-muted-foreground">Your times, your format.</p>
                  </button>
                  {errors.package && <p className="text-sm text-destructive">Choose a package to continue</p>}
                </div>
              )}

              {step === 1 && (
                <>
                  <Field label="Event date" error={errors.event_date}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal"><CalendarIcon />{f.event_date ? formatDateDE(f.event_date) : "TT.MM.JJJJ"}</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" weekStartsOn={1} disabled={{ before: new Date() }} selected={f.event_date ? new Date(f.event_date + "T12:00:00") : undefined}
                          onSelect={(d) => d && set("event_date", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)} />
                      </PopoverContent>
                    </Popover>
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Start time" error={errors.start_time}><Input type="time" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} /></Field>
                    <Field label="End time" error={errors.end_time} hint="Past midnight is fine"><Input type="time" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} /></Field>
                  </div>
                  {cfg && f.start_time && f.end_time && quote && quote.durationHours > cfg.crew_max_hours && (
                    <p className="rounded-xl bg-warning/15 p-3 text-sm">
                      Your event lasts {quote.durationHours.toFixed(1)} h. Our crews work max {cfg.crew_max_hours} h per event, so {cfg.second_crew_enabled ? `a second crew shift (${eur(cfg.second_crew_fee_per_truck)} per vehicle) is added.` : "this length can't be booked right now."}
                    </p>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Venue name" error={errors.venue_name}><Input value={f.venue_name} onChange={(e) => set("venue_name", e.target.value)} placeholder="e.g. Campus Vaihingen, Building 3" /></Field>
                  <Field label="Venue address" error={errors.address || errors.town}>
                    <AddressAutocomplete value={f.address} onType={(v) => setF((x) => ({ ...x, address: v, lat: null, lon: null, town: "" }))} onSelect={(r) => setF((x) => ({ ...x, address: r.label, lat: r.lat, lon: r.lon, town: r.town }))} />
                  </Field>
                  {cfg && (
                    <div className="space-y-2">
                      <RouteMap depot={cfg.depot} dest={dest} geometry={routeQ.data?.geometry} />
                      {routeQ.isFetching && <p className="text-xs text-muted-foreground">Measuring road distance…</p>}
                      {routeQ.data && <p className="text-sm"><strong>{routeQ.data.km.toFixed(1)} km</strong> by road from our depot · town: <strong>{f.town || "unknown"}</strong></p>}
                      {routeQ.isError && <p className="text-sm text-destructive">We couldn't measure the road distance. Try again shortly.</p>}
                    </div>
                  )}
                  <Field label="Venue type" error={errors.venue_type}>
                    <div className="grid grid-cols-2 gap-2">
                      {([["public_ground", "Public ground"], ["private_campus", "Private company campus"]] as const).map(([v, l]) => (
                        <button key={v} type="button" onClick={() => set("venue_type", v)} className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${f.venue_type === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>{l}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="400V power available on site?" error={errors.has_400v}><YesNo value={f.has_400v} onChange={(v) => set("has_400v", v)} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Overhead clearance (m)" error={errors.clearance_m}>
                      <Input inputMode="decimal" disabled={f.no_clearance_limit} value={f.clearance_m} onChange={(e) => set("clearance_m", e.target.value)} placeholder="e.g. 3.5" />
                      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.no_clearance_limit} onChange={(e) => set("no_clearance_limit", e.target.checked)} /> No height limit (open air)</label>
                    </Field>
                    <Field label="Space available (m²)" error={errors.space_m2}><Input inputMode="decimal" value={f.space_m2} onChange={(e) => set("space_m2", e.target.value)} placeholder="e.g. 80" /></Field>
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Total guests" error={errors.guests}><Input inputMode="numeric" value={f.guests} onChange={(e) => set("guests", e.target.value)} /></Field>
                  <Field label="Vegan guests" error={errors.vegan}><Input inputMode="numeric" value={f.vegan} onChange={(e) => set("vegan", e.target.value)} /></Field>
                  <Field label="Gluten-free guests" error={errors.gluten_free}><Input inputMode="numeric" value={f.gluten_free} onChange={(e) => set("gluten_free", e.target.value)} /></Field>
                  <Field label="Halal guests" error={errors.halal}><Input inputMode="numeric" value={f.halal} onChange={(e) => set("halal", e.target.value)} /></Field>
                  <p className="text-xs text-muted-foreground sm:col-span-2">Enter 0 if none. We'll pick trucks that cover every diet.</p>
                </div>
              )}

              {step === 4 && (
                <button type="button" onClick={() => set("espresso", !f.espresso)} className={`w-full rounded-2xl border p-6 text-left transition-all ${f.espresso ? "border-primary shadow-elegant" : "hover:border-primary/50"}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">☕ Espresso Express</h3>
                    <span className="font-semibold">{cfg ? eur(cfg.espresso_price) : "…"} net</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Barista coffee bar, flat fee. Only together with at least one food truck. {f.espresso ? "✓ Added" : "Tap to add"}</p>
                </button>
              )}

              {step === 5 && (
                <>
                  <Field label="Company name" error={errors.company_name}><Input value={f.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
                  <Field label="Billing address" error={errors.billing_address}><Textarea value={f.billing_address} onChange={(e) => set("billing_address", e.target.value)} /></Field>
                  <Field label="PO number" error={errors.po_number} hint="Mandatory — no PO, no booking."><Input value={f.po_number} onChange={(e) => set("po_number", e.target.value)} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Contact person" error={errors.contact_name}><Input value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></Field>
                    <Field label="Contact mobile" error={errors.contact_mobile}><Input type="tel" value={f.contact_mobile} onChange={(e) => set("contact_mobile", e.target.value)} placeholder="+49 170 1234567" /></Field>
                  </div>
                  {quote?.needsApproval && cfg && (
                    <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                      <p className="text-sm">This order is above {eur(cfg.approval_threshold)} ({cfg.approval_basis}), so a second person at your company must approve it.</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Approver name" error={errors.approver_name}><Input value={f.approver_name} onChange={(e) => set("approver_name", e.target.value)} /></Field>
                        <Field label="Approver email" error={errors.approver_email}><Input type="email" value={f.approver_email} onChange={(e) => set("approver_email", e.target.value)} /></Field>
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 6 && (
                <div className="space-y-4 text-sm">
                  <h2 className="text-2xl font-semibold">Review</h2>
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {[
                      ["Package", f.package === "afterwork" ? cfg?.afterwork_package.name : "Custom"],
                      ["Date", `${formatDateDE(f.event_date)}, ${f.start_time}–${f.end_time}`],
                      ["Venue", `${f.venue_name}, ${f.address}`],
                      ["Venue type", f.venue_type === "public_ground" ? "Public ground" : "Private company campus"],
                      ["Power / clearance / space", `${f.has_400v ? "400V" : "No 400V"} · ${f.no_clearance_limit ? "no height limit" : f.clearance_m + " m"} · ${f.space_m2} m²`],
                      ["Guests", `${f.guests} (vegan ${f.vegan}, gluten-free ${f.gluten_free}, halal ${f.halal})`],
                      ["Company", `${f.company_name} · PO ${f.po_number}`],
                      ["Contact", `${f.contact_name} · ${f.contact_mobile}`],
                    ].map(([k, v]) => (
                      <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                    ))}
                  </dl>
                  {result && !result.ok && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                      {result.leadCreated ? "We've passed your request to our team — they'll contact you about permits for this town." : result.error ?? "This booking can't be processed — see the issues in the quote panel."}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft /> Back</Button>
            {step < STEPS.length - 1 ? (
              <Button variant="hero" onClick={next}>Continue <ChevronRight /></Button>
            ) : (
              <Button variant="hero" onClick={doSubmit} disabled={submitting || !quote?.ok}>{submitting ? "Submitting…" : quote?.needsApproval ? "Send for approval" : "Confirm booking"}</Button>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass rounded-3xl p-6">
            <h2 className="mb-4 text-xl font-semibold">Live quote</h2>
            {!f.event_date || !dest ? (
              <p className="text-sm text-muted-foreground">Pick a date and venue address to see your quote.</p>
            ) : (
              <QuoteSummary quote={quote} loading={staticQ.isLoading || dateQ.isLoading || routeQ.isLoading} />
            )}
            {quote && step === 6 && (
              <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => downloadQuotePdf({ ...toPayload(f), distance_km: routeQ.data!.km, distance_method: routeQ.data!.method } as any, quote)}>
                <Download /> Download quote PDF
              </Button>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function SuccessView({ result, form }: { result: Extract<SubmitResult, { ok: true }>; form: Form }) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [label, setLabel] = useState("");
  const qc = useQueryClient();
  const link = result.approvalToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/approve/${result.approvalToken}` : null;

  const savePreset = async () => {
    if (!label.trim()) return toast.error("Give your place a name");
    const { data: u } = await supabase.auth.getUser();
    const p = toPayload(form);
    const { error } = await supabase.from("event_presets").insert({
      user_id: u.user!.id, label: label.trim(), venue_name: form.venue_name, address: form.address, town: form.town, lat: form.lat, lon: form.lon,
      venue_type: form.venue_type as any, has_400v: !!form.has_400v, clearance_m: p.clearance_m ?? null, space_m2: p.space_m2!, start_time: form.start_time,
      end_time: form.end_time, guests: p.guests!, vegan: p.vegan!, gluten_free: p.gluten_free!, halal: p.halal!,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved to your places");
    qc.invalidateQueries({ queryKey: ["presets"] });
    setSaveOpen(false);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-3xl p-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground"><Check className="size-7" /></div>
        <h1 className="mt-4 text-3xl font-semibold">{result.status === "confirmed" ? "Booking confirmed" : "Awaiting client approval"}</h1>
        <p className="mt-1 text-muted-foreground">Reference {result.ref} · {eur(result.quote.totalGross)} gross</p>
        {link && (
          <div className="mt-6 rounded-2xl border p-4 text-left">
            <p className="text-sm">Send this link to <strong>{form.approver_name}</strong> ({form.approver_email}). They can accept or reject without an account.</p>
            <div className="mt-3 flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}><Copy /></Button>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="hero" asChild><Link to="/bookings/$id" params={{ id: result.bookingId }}>View booking</Link></Button>
          <Button variant="outline" onClick={() => setSaveOpen(true)}><Bookmark /> Save this as a preset</Button>
        </div>
      </motion.div>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save this place</DialogTitle></DialogHeader>
          <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. HQ summer party" /></Field>
          <Button variant="hero" onClick={savePreset}>Save preset</Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
