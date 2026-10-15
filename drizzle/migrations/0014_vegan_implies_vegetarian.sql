CREATE OR REPLACE FUNCTION public.trucks_vegan_vegetarian() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
begin
  if new.vegan then new.vegetarian := true; end if;
  return new;
end; $$;
CREATE TRIGGER trucks_vegan_vegetarian BEFORE INSERT OR UPDATE ON public.trucks FOR EACH ROW EXECUTE FUNCTION public.trucks_vegan_vegetarian();