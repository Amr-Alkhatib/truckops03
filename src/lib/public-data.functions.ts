// Reference data (fleet, prices, rules, towns) is only readable by staff in the
// database; everyone else receives it through these server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadDateData, loadStatic, todayISO } from "./data";

const dateRe = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function assertLink(token: string) {
  const sb = await admin();
  const { data } = await sb.from("planner_links").select("active, expires_on").eq("token", token).maybeSingle();
  if (!data || !data.active || (data.expires_on && data.expires_on < todayISO())) throw new Error("This booking link is invalid or has expired.");
}

/** Landing page: active packages + public price settings. */
export const getPublicHome = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();
  const [p, c] = await Promise.all([
    sb.from("packages").select("*").eq("active", true).order("sort"),
    sb.from("app_config").select("config").eq("id", 1).single(),
  ]);
  if (p.error) throw p.error;
  if (c.error) throw c.error;
  return { packages: p.data ?? [], config: c.data.config as any };
});

export const getEngineStatic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => JSON.parse(JSON.stringify(await loadStatic(await admin()))));

export const getEngineStaticByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data }) => {
    await assertLink(data.token);
    return JSON.parse(JSON.stringify(await loadStatic(await admin())));
  });

export const getEngineDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ date: dateRe }).parse(d))
  .handler(async ({ data }) => JSON.parse(JSON.stringify(await loadDateData(await admin(), data.date))));

export const getEngineDateByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128), date: dateRe }).parse(d))
  .handler(async ({ data }) => {
    await assertLink(data.token);
    return JSON.parse(JSON.stringify(await loadDateData(await admin(), data.date)));
  });
