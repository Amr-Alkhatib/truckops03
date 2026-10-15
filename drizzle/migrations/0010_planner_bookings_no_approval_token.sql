CREATE OR REPLACE FUNCTION public.get_planner_bookings(_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_date), '[]'::jsonb) from (
    select b.ref, b.status, b.event_date, b.start_time, b.end_time, b.venue_name, b.guests, b.total_net, b.total_gross
    from public.bookings b join public.planner_links l on l.id = b.planner_link_id
    where l.token = _token and length(_token) >= 32 and l.active) x
$$;
COMMENT ON COLUMN public.bookings.planner_token IS 'DEPRECATED: unused, planner_link_id is used instead';