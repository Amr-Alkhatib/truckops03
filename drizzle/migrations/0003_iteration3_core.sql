-- System rules
ALTER TABLE public.pair_rules ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.pair_rules ADD COLUMN IF NOT EXISTS system_key text;
ALTER TABLE public.pair_rules ADD COLUMN IF NOT EXISTS params jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS pair_rules_system_key_idx ON public.pair_rules(system_key) WHERE system_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_system_rules() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if tg_op = 'INSERT' then
    if new.is_system and auth.uid() is not null then raise exception 'System rules can only be created by Rolling Feast'; end if;
    return new;
  end if;
  if old.is_system then raise exception 'This is a locked system rule (Sabine''s whiteboard) and cannot be changed or deleted'; end if;
  if tg_op = 'UPDATE' and new.is_system and auth.uid() is not null then raise exception 'Cannot mark a rule as system rule'; end if;
  return coalesce(new, old);
end; $$;
DROP TRIGGER IF EXISTS pair_rules_protect ON public.pair_rules;
CREATE TRIGGER pair_rules_protect BEFORE INSERT OR UPDATE OR DELETE ON public.pair_rules FOR EACH ROW EXECUTE FUNCTION public.protect_system_rules();

-- VAT rates by date of service
CREATE TABLE public.vat_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('food','beverage','services','permit')),
  rate numeric NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  label text NOT NULL DEFAULT '',
  legal_basis text NOT NULL DEFAULT '',
  source_url text,
  source_title text,
  verified_on date,
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('verified','unverified')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vat_rates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vat_rates TO authenticated;
GRANT ALL ON public.vat_rates TO service_role;
ALTER TABLE public.vat_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vat readable" ON public.vat_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage vat" ON public.vat_rates FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Towns: richer, sourced permit data
ALTER TABLE public.towns
  ADD COLUMN IF NOT EXISTS landkreis text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS fee_value numeric,
  ADD COLUMN IF NOT EXISTS fee_table jsonb,
  ADD COLUMN IF NOT EXISTS min_fee numeric,
  ADD COLUMN IF NOT EXISTS lead_weeks integer,
  ADD COLUMN IF NOT EXISTS authority_name text,
  ADD COLUMN IF NOT EXISTS authority_address text,
  ADD COLUMN IF NOT EXISTS authority_phone text,
  ADD COLUMN IF NOT EXISTS authority_email text,
  ADD COLUMN IF NOT EXISTS legal_basis text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_title text,
  ADD COLUMN IF NOT EXISTS night_warn_from time DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS auto_created boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.towns.fee_amount IS 'DEPRECATED: replaced by fee_value (nullable = unknown)';
COMMENT ON COLUMN public.towns.lead_time_weeks IS 'DEPRECATED: replaced by lead_weeks (nullable = not published)';
COMMENT ON COLUMN public.towns.verified_on IS 'Date the source was last checked';

CREATE TABLE public.town_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id uuid NOT NULL REFERENCES public.towns(id) ON DELETE CASCADE,
  sort integer NOT NULL DEFAULT 0,
  item text NOT NULL,
  legal_basis text NOT NULL DEFAULT '',
  source_url text,
  done boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.town_checklist TO authenticated;
GRANT ALL ON public.town_checklist TO service_role;
ALTER TABLE public.town_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage checklist" ON public.town_checklist FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Compliance sources
ALTER TABLE public.compliance_docs
  ADD COLUMN IF NOT EXISTS legal_basis text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_title text,
  ADD COLUMN IF NOT EXISTS verified_on date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS renew_every_months integer;

-- Crews
CREATE TABLE public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  members text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.crews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.crews TO authenticated;
GRANT ALL ON public.crews TO service_role;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crews readable" ON public.crews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage crews" ON public.crews FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.truck_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  day_type text NOT NULL DEFAULT 'all' CHECK (day_type IN ('all','weekday','weekend')),
  UNIQUE (truck_id, day_type)
);
GRANT SELECT ON public.truck_crew TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.truck_crew TO authenticated;
GRANT ALL ON public.truck_crew TO service_role;
ALTER TABLE public.truck_crew ENABLE ROW LEVEL SECURITY;
CREATE POLICY "truck crew readable" ON public.truck_crew FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage truck crew" ON public.truck_crew FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Bookings: new fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS sales_to_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alcohol_served boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS permit_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS permit_number text,
  ADD COLUMN IF NOT EXISTS permit_fee numeric,
  ADD COLUMN IF NOT EXISTS permit_issued_on date,
  ADD COLUMN IF NOT EXISTS permit_file_path text,
  ADD COLUMN IF NOT EXISTS street_group text,
  ADD COLUMN IF NOT EXISTS route_clearance_status text NOT NULL DEFAULT 'not_needed',
  ADD COLUMN IF NOT EXISTS route_clearance_note text,
  ADD COLUMN IF NOT EXISTS conflict_reason text;

-- Assignments (one truck, one booking per day)
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  truck_id uuid NOT NULL REFERENCES public.trucks(id),
  event_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX assignments_truck_day_uidx ON public.assignments(truck_id, event_date);
GRANT SELECT ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read assignments" ON public.assignments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.staff_notifications TO authenticated;
GRANT ALL ON public.staff_notifications TO service_role;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read notifications" ON public.staff_notifications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update notifications" ON public.staff_notifications FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Computed fields are engine-only
CREATE OR REPLACE FUNCTION public.protect_computed_fields() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if coalesce(current_setting('app.engine', true), '') <> 'on' and (
     new.quote is distinct from old.quote or new.total_net is distinct from old.total_net or new.total_gross is distinct from old.total_gross
     or new.distance_km is distinct from old.distance_km or new.distance_method is distinct from old.distance_method
     or new.truck_ids is distinct from old.truck_ids or new.lat is distinct from old.lat or new.lon is distinct from old.lon) then
    raise exception 'Totals, VAT, distance, zone and truck assignment are computed by the engine and are read-only';
  end if;
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    if new.permit_status = 'required' then raise exception 'Record the permit before confirming this booking'; end if;
    if new.route_clearance_status = 'unverified' then raise exception 'Confirm the route clearance for Wurst Case Scenario before confirming'; end if;
  end if;
  return new;
end; $$;
DROP TRIGGER IF EXISTS bookings_protect_computed ON public.bookings;
CREATE TRIGGER bookings_protect_computed BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.protect_computed_fields();

-- Occupancy includes new active statuses
CREATE OR REPLACE FUNCTION public.truck_occupancy(_from date, _to date)
 RETURNS TABLE(event_date date, truck_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select b.event_date, unnest(b.truck_ids) from public.bookings b
  where b.event_date between _from and _to and b.status in ('awaiting_approval','permit_check','confirmed','conflict','completed')
$$;

-- Anonymised booking requirements for the solver (no personal data)
CREATE OR REPLACE FUNCTION public.day_bookings(_from date, _to date)
 RETURNS TABLE(id uuid, event_date date, status text, package text, start_time time, end_time time, venue_type text, town text,
   has_400v boolean, clearance_m numeric, space_m2 numeric, guests integer, vegan integer, gluten_free integer, halal integer,
   espresso boolean, distance_km numeric, truck_ids uuid[], locked boolean, sales_to_public boolean, alcohol_served boolean, street_group text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select b.id, b.event_date, b.status::text, b.package, b.start_time, b.end_time, b.venue_type::text, b.town, b.has_400v, b.clearance_m, b.space_m2,
    b.guests, b.vegan, b.gluten_free, b.halal, b.espresso, b.distance_km, b.truck_ids,
    (b.event_date <= (now() at time zone 'Europe/Berlin')::date + 7 or b.permit_status = 'issued'), b.sales_to_public, b.alcohol_served, b.street_group
  from public.bookings b
  where b.event_date between _from and _to and b.status in ('awaiting_approval','permit_check','confirmed','conflict')
  order by b.created_at
$$;
GRANT EXECUTE ON FUNCTION public.day_bookings(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.day_snapshot(_date date) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select md5(coalesce(string_agg(booking_id::text || ':' || truck_id::text, ',' order by booking_id, truck_id), '')) from public.assignments where event_date = _date
$$;
REVOKE EXECUTE ON FUNCTION public.day_snapshot(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.day_snapshot(date) TO service_role;

-- Atomic, locked commit of a solver plan for one day
CREATE OR REPLACE FUNCTION public.commit_day_plan(_date date, _snapshot text, _new jsonb, _changes jsonb, _actor text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare c jsonb; cur text; b public.bookings;
begin
  perform pg_advisory_xact_lock(hashtext('truckops-day-' || _date::text));
  select md5(coalesce(string_agg(booking_id::text || ':' || truck_id::text, ',' order by booking_id, truck_id), '')) into cur from public.assignments where event_date = _date;
  if cur <> _snapshot then raise exception 'stale_plan'; end if;
  perform set_config('app.engine', 'on', true);
  perform set_config('app.actor', coalesce(_actor, 'engine'), true);
  if _new is not null then
    insert into public.bookings select * from jsonb_populate_record(null::public.bookings, _new);
  end if;
  for c in select * from jsonb_array_elements(coalesce(_changes, '[]'::jsonb)) loop
    select * into b from public.bookings where id = (c->>'id')::uuid for update;
    if not found then continue; end if;
    perform set_config('app.note', coalesce(c->>'note', ''), true);
    update public.bookings set
      truck_ids = coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(c->'truck_ids') x), truck_ids),
      quote = coalesce(c->'quote', quote),
      total_net = coalesce((c->>'total_net')::numeric, total_net),
      total_gross = coalesce((c->>'total_gross')::numeric, total_gross),
      status = coalesce((c->>'status')::booking_status, status),
      conflict_reason = case when c ? 'conflict_reason' then c->>'conflict_reason' else conflict_reason end
    where id = b.id;
    if c ? 'truck_ids' and (c->>'note') is not null then
      insert into public.booking_audit (booking_id, from_status, to_status, actor, note) values (b.id, b.status, coalesce((c->>'status')::booking_status, b.status), coalesce(_actor,'engine'), c->>'note');
    end if;
    if (c->>'notify') is not null then
      insert into public.staff_notifications (booking_id, kind, message) values (b.id, coalesce(c->>'kind','reassign'), c->>'notify');
    end if;
  end loop;
  delete from public.assignments where event_date = _date;
  insert into public.assignments (booking_id, truck_id, event_date)
    select bk.id, unnest(bk.truck_ids), bk.event_date from public.bookings bk
    where bk.event_date = _date and bk.status in ('awaiting_approval','permit_check','confirmed','conflict','completed');
  select md5(coalesce(string_agg(booking_id::text || ':' || truck_id::text, ',' order by booking_id, truck_id), '')) into cur from public.assignments where event_date = _date;
  return cur;
end; $$;
REVOKE EXECUTE ON FUNCTION public.commit_day_plan(date, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_day_plan(date, text, jsonb, jsonb, text) TO service_role;

-- Staff records permit / route clearance
CREATE OR REPLACE FUNCTION public.record_permit(_id uuid, _number text, _fee numeric, _issued date, _file text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare b public.bookings;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not allowed'; end if;
  if coalesce(trim(_number),'') = '' or _issued is null then raise exception 'Permit number and issue date are required'; end if;
  select * into b from public.bookings where id = _id for update;
  update public.bookings set permit_status = 'issued', permit_number = _number, permit_fee = _fee, permit_issued_on = _issued, permit_file_path = _file where id = _id;
  if b.status = 'permit_check' and b.route_clearance_status <> 'unverified' then
    perform set_config('app.note', 'Permit ' || _number || ' recorded', true);
    update public.bookings set status = 'confirmed' where id = _id;
    return 'confirmed';
  end if;
  return b.status::text;
end; $$;
GRANT EXECUTE ON FUNCTION public.record_permit(uuid, text, numeric, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_route_clearance(_id uuid, _note text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare b public.bookings;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not allowed'; end if;
  select * into b from public.bookings where id = _id for update;
  update public.bookings set route_clearance_status = 'staff_confirmed', route_clearance_note = left(coalesce(_note,''), 500) where id = _id;
  if b.status = 'permit_check' and b.permit_status <> 'required' then
    perform set_config('app.note', 'Route clearance confirmed by staff', true);
    update public.bookings set status = 'confirmed' where id = _id;
    return 'confirmed';
  end if;
  return b.status::text;
end; $$;
GRANT EXECUTE ON FUNCTION public.confirm_route_clearance(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_street_group(_id uuid, _group text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not allowed'; end if;
  if _group not in ('1','2','3','S') then raise exception 'Street group must be 1, 2, 3 or S'; end if;
  update public.bookings set street_group = _group where id = _id;
end; $$;
GRANT EXECUTE ON FUNCTION public.set_street_group(uuid, text) TO authenticated;

-- Client approval respects permit/route checks
CREATE OR REPLACE FUNCTION public.respond_to_approval(_token text, _accept boolean, _reason text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare b public.bookings; target booking_status;
begin
  select * into b from public.bookings where approval_token = _token and length(_token) >= 32;
  if not found then raise exception 'Invalid link'; end if;
  if b.status <> 'awaiting_approval' then raise exception 'This quote has already been answered'; end if;
  perform set_config('app.actor', coalesce(b.approver_email,'client approver'), true);
  perform set_config('app.note', left(coalesce(_reason,''), 500), true);
  if not _accept then target := 'rejected';
  elsif b.permit_status = 'required' or b.route_clearance_status = 'unverified' then target := 'permit_check';
  else target := 'confirmed'; end if;
  update public.bookings set status = target, client_response_reason = left(_reason, 500) where id = b.id;
  return target::text;
end; $$;