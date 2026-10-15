CREATE TABLE public.yards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  active_from date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','planned','closed')),
  relief_crews integer NOT NULL DEFAULT 0 CHECK (relief_crews >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.yards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.yards TO authenticated;
GRANT ALL ON public.yards TO service_role;
ALTER TABLE public.yards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "yards readable" ON public.yards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage yards" ON public.yards FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.truck_yard_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id),
  yard_id uuid NOT NULL REFERENCES public.yards(id),
  valid_from date NOT NULL,
  valid_to date,
  moved_by text NOT NULL DEFAULT 'system',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
GRANT SELECT ON public.truck_yard_assignments TO anon, authenticated;
GRANT INSERT, UPDATE ON public.truck_yard_assignments TO authenticated;
GRANT ALL ON public.truck_yard_assignments TO service_role;
ALTER TABLE public.truck_yard_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "truck yards readable" ON public.truck_yard_assignments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage truck yards" ON public.truck_yard_assignments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX truck_yard_assignments_truck_idx ON public.truck_yard_assignments (truck_id, valid_from);

-- staff move: close the open assignment the day before and open a new one (atomic)
CREATE OR REPLACE FUNCTION public.move_truck_to_yard(_truck uuid, _yard uuid, _from date, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare who text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not allowed'; end if;
  if _from is null then raise exception 'Effective date is required'; end if;
  who := coalesce((select email from public.profiles where id = auth.uid()), 'staff');
  perform pg_advisory_xact_lock(hashtext('truckops-truck-yard-' || _truck::text));
  -- drop future assignments that start on/after the new date
  update public.truck_yard_assignments set valid_to = _from - 1 where truck_id = _truck and valid_from < _from and (valid_to is null or valid_to >= _from);
  update public.truck_yard_assignments set valid_to = valid_from, note = note || ' (superseded)' where truck_id = _truck and valid_from >= _from and (valid_to is null or valid_to > valid_from);
  insert into public.truck_yard_assignments (truck_id, yard_id, valid_from, moved_by, note) values (_truck, _yard, _from, who, left(coalesce(_note,''), 500));
end; $$;
REVOKE EXECUTE ON FUNCTION public.move_truck_to_yard(uuid, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_truck_to_yard(uuid, uuid, date, text) TO authenticated;

CREATE TABLE public.route_cache (
  yard_id uuid NOT NULL REFERENCES public.yards(id),
  lat5 numeric NOT NULL,
  lon5 numeric NOT NULL,
  km numeric NOT NULL,
  method text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (yard_id, lat5, lon5)
);
GRANT ALL ON public.route_cache TO service_role;
ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.trucks ADD COLUMN vegetarian boolean NOT NULL DEFAULT false;
ALTER TABLE public.trucks ADD COLUMN available_from date;
ALTER TABLE public.trucks ADD COLUMN available_to date;

ALTER TABLE public.bookings ADD COLUMN yard_distances jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.bookings.yard_distances IS 'Road km from each yard: {yard_id: {km, method, at}}; engine-computed';

ALTER TABLE public.compliance_docs ADD COLUMN due_on date;
ALTER TABLE public.compliance_docs ADD COLUMN file_path text;
ALTER TABLE public.compliance_docs ADD COLUMN onboarding text;
ALTER TABLE public.compliance_docs ADD COLUMN done boolean NOT NULL DEFAULT false;
ALTER TABLE public.compliance_docs ADD COLUMN yard_id uuid REFERENCES public.yards(id);
COMMENT ON COLUMN public.compliance_docs.onboarding IS 'Onboarding checklist group (e.g. heilbronn); items with done=false block confirming their truck';

-- protect yard_distances like other computed fields
CREATE OR REPLACE FUNCTION public.protect_computed_fields()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
begin
  if coalesce(current_setting('app.engine', true), '') <> 'on' and (
     new.quote is distinct from old.quote or new.total_net is distinct from old.total_net or new.total_gross is distinct from old.total_gross
     or new.distance_km is distinct from old.distance_km or new.distance_method is distinct from old.distance_method
     or new.truck_ids is distinct from old.truck_ids or new.lat is distinct from old.lat or new.lon is distinct from old.lon
     or new.yard_distances is distinct from old.yard_distances) then
    raise exception 'Totals, VAT, distance, zone and truck assignment are computed by the engine and are read-only';
  end if;
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    if new.permit_status = 'required' then raise exception 'Record the permit before confirming this booking'; end if;
    if new.route_clearance_status = 'unverified' then raise exception 'Confirm the route clearance for Wurst Case Scenario before confirming'; end if;
    if exists (select 1 from public.compliance_docs d where d.onboarding is not null and d.required and not d.done and d.truck_id = any(new.truck_ids)) then
      raise exception 'A truck on this booking is still onboarding — complete its onboarding documents first';
    end if;
  end if;
  return new;
end; $$;

-- incomplete onboarding items per truck (no personal data)
CREATE OR REPLACE FUNCTION public.onboarding_open() RETURNS TABLE(truck_id uuid, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select d.truck_id, d.label from public.compliance_docs d where d.onboarding is not null and d.required and not d.done and d.truck_id is not null
$$;

DROP FUNCTION public.day_bookings(date, date);
CREATE FUNCTION public.day_bookings(_from date, _to date)
 RETURNS TABLE(id uuid, event_date date, status text, package text, start_time time, end_time time, venue_type text, town text, has_400v boolean, clearance_m numeric, space_m2 numeric, guests integer, vegan integer, gluten_free integer, halal integer, espresso boolean, distance_km numeric, truck_ids uuid[], locked boolean, sales_to_public boolean, alcohol_served boolean, street_group text, yard_distances jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select b.id, b.event_date, b.status::text, b.package, b.start_time, b.end_time, b.venue_type::text, b.town, b.has_400v, b.clearance_m, b.space_m2,
    b.guests, b.vegan, b.gluten_free, b.halal, b.espresso, b.distance_km, b.truck_ids,
    (b.event_date <= (now() at time zone 'Europe/Berlin')::date + 7 or b.permit_status = 'issued'), b.sales_to_public, b.alcohol_served, b.street_group, b.yard_distances
  from public.bookings b
  where b.event_date between _from and _to and b.status in ('awaiting_approval','permit_check','confirmed','conflict')
  order by b.created_at
$$;

DO $$ declare t text; begin
  foreach t in array array['yards','truck_yard_assignments'] loop
    execute format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_admin_change()', t || '_change_log', t);
  end loop;
end $$;