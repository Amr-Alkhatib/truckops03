CREATE TABLE public.admin_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id text,
  action text NOT NULL,
  actor_id uuid,
  actor text NOT NULL DEFAULT 'system',
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_change_log TO authenticated;
GRANT ALL ON public.admin_change_log TO service_role;
ALTER TABLE public.admin_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read change log" ON public.admin_change_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX admin_change_log_created_idx ON public.admin_change_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_admin_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o jsonb; n jsonb;
begin
  o := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  if tg_op = 'UPDATE' and o = n then return new; end if;
  insert into public.admin_change_log (table_name, row_id, action, actor_id, actor, old_data, new_data)
  values (tg_table_name, coalesce(n->>'id', o->>'id'), lower(tg_op), auth.uid(),
          coalesce((select email from public.profiles where id = auth.uid()), nullif(current_setting('app.actor', true), ''), 'system'), o, n);
  return coalesce(new, old);
end; $$;

CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  start_time time NOT NULL,
  end_time time NOT NULL,
  bestseller boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages readable" ON public.packages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage packages" ON public.packages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
INSERT INTO public.packages (slug, name, description, start_time, end_time, bestseller, sort)
SELECT 'afterwork', coalesce(config->'afterwork_package'->>'name','Afterwork Party'), 'Our best-seller for after-work company parties.',
       coalesce(config->'afterwork_package'->>'start','17:00')::time, coalesce(config->'afterwork_package'->>'end','23:30')::time, true, 0
FROM public.app_config WHERE id = 1;

CREATE TABLE public.planner_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  billing_address text NOT NULL DEFAULT '',
  contact_email text,
  owner_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.planner_links TO authenticated;
GRANT ALL ON public.planner_links TO service_role;
ALTER TABLE public.planner_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or staff read links" ON public.planner_links FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "create own links" ON public.planner_links FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND length(token) >= 32);
CREATE POLICY "own or staff update links" ON public.planner_links FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (owner_id = auth.uid() OR public.is_staff(auth.uid()));

ALTER TABLE public.bookings ADD COLUMN planner_link_id uuid REFERENCES public.planner_links(id);
ALTER TABLE public.bookings ADD COLUMN planner_token text;

CREATE OR REPLACE FUNCTION public.get_planner_link(_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select to_jsonb(x) from (select id, label, company_name, billing_address from public.planner_links
    where token = _token and length(_token) >= 32 and active and (expires_on is null or expires_on >= current_date)) x
$$;
CREATE OR REPLACE FUNCTION public.get_planner_bookings(_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_date), '[]'::jsonb) from (
    select b.ref, b.status, b.event_date, b.start_time, b.end_time, b.venue_name, b.guests, b.total_net, b.total_gross, b.planner_token, b.approval_token
    from public.bookings b join public.planner_links l on l.id = b.planner_link_id
    where l.token = _token and length(_token) >= 32 and l.active) x
$$;

DO $$ declare t text; begin
  foreach t in array array['app_config','trucks','truck_blackouts','pair_rules','towns','town_checklist','vat_rates','compliance_docs','crews','truck_crew','user_roles','packages','planner_links'] loop
    execute format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_admin_change()', t || '_change_log', t);
  end loop;
end $$;