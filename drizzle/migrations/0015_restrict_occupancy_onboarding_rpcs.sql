REVOKE EXECUTE ON FUNCTION public.truck_occupancy(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.truck_occupancy(date, date) TO service_role;
REVOKE EXECUTE ON FUNCTION public.onboarding_open() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_open() TO authenticated, service_role;