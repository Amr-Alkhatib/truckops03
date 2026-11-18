DROP POLICY IF EXISTS "config readable" ON public.app_config;
CREATE POLICY "staff read config" ON public.app_config FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "crews readable" ON public.crews;
DROP POLICY IF EXISTS "packages readable" ON public.packages;
DROP POLICY IF EXISTS "rules readable" ON public.pair_rules;
DROP POLICY IF EXISTS "towns readable" ON public.towns;
DROP POLICY IF EXISTS "blackouts readable" ON public.truck_blackouts;
DROP POLICY IF EXISTS "truck crew readable" ON public.truck_crew;
DROP POLICY IF EXISTS "truck yards readable" ON public.truck_yard_assignments;
DROP POLICY IF EXISTS "trucks readable" ON public.trucks;
DROP POLICY IF EXISTS "vat readable" ON public.vat_rates;
DROP POLICY IF EXISTS "yards readable" ON public.yards;

CREATE OR REPLACE FUNCTION public.day_bookings(_from date, _to date)
 RETURNS TABLE(id uuid, event_date date, status text, package text, start_time time without time zone, end_time time without time zone, venue_type text, town text, has_400v boolean, clearance_m numeric, space_m2 numeric, guests integer, vegan integer, gluten_free integer, halal integer, espresso boolean, distance_km numeric, truck_ids uuid[], locked boolean, sales_to_public boolean, alcohol_served boolean, street_group text, yard_distances jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select b.id, b.event_date, b.status::text, b.package, b.start_time, b.end_time, b.venue_type::text, b.town, b.has_400v, b.clearance_m, b.space_m2,
    b.guests, b.vegan, b.gluten_free, b.halal, b.espresso, b.distance_km, b.truck_ids,
    (b.event_date <= (now() at time zone 'Europe/Berlin')::date + 7 or b.permit_status = 'issued'), b.sales_to_public, b.alcohol_served, b.street_group, b.yard_distances
  from public.bookings b
  where b.event_date between _from and _to and b.status in ('awaiting_approval','permit_check','confirmed','conflict')
    and (auth.role() = 'service_role' or public.is_staff(auth.uid()))
  order by b.created_at
$function$;

CREATE OR REPLACE FUNCTION public.compliance_status(_on date)
 RETURNS TABLE(doc_type text, label text, truck_id uuid, crew_member text, expires_on date, expired boolean, required boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select doc_type, label, truck_id, crew_member, expires_on, (expires_on is not null and expires_on < _on), required
  from public.compliance_docs where (required or doc_type = 'reisegewerbekarte')
    and (auth.role() = 'service_role' or public.is_staff(auth.uid()))
$function$;

CREATE OR REPLACE FUNCTION public.get_planner_bookings(_token text)
 RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_date), '[]'::jsonb) from (
    select b.ref, b.status, b.event_date, b.start_time, b.end_time, b.venue_name, b.guests, b.total_net, b.total_gross
    from public.bookings b join public.planner_links l on l.id = b.planner_link_id
    where l.token = _token and length(_token) >= 32 and l.active
      and (l.expires_on is null or l.expires_on >= (now() at time zone 'Europe/Berlin')::date)) x
$function$;

REVOKE EXECUTE ON FUNCTION public.day_bookings(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compliance_status(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.day_bookings(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compliance_status(date) TO authenticated, service_role;