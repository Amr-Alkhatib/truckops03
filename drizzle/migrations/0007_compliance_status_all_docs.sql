DROP FUNCTION IF EXISTS public.compliance_status(date);
CREATE FUNCTION public.compliance_status(_on date)
 RETURNS TABLE(doc_type text, label text, truck_id uuid, crew_member text, expires_on date, expired boolean, required boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select doc_type, label, truck_id, crew_member, expires_on, (expires_on is not null and expires_on < _on), required
  from public.compliance_docs where required or doc_type = 'reisegewerbekarte'
$$;
GRANT EXECUTE ON FUNCTION public.compliance_status(date) TO anon, authenticated;