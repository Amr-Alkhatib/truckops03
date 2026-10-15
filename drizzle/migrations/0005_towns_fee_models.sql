ALTER TABLE public.towns DROP CONSTRAINT IF EXISTS towns_fee_model_check;
ALTER TABLE public.towns ADD CONSTRAINT towns_fee_model_check CHECK (fee_model IN ('per_started_m2_per_day','per_started_3m2_per_day','per_truck','flat','unknown','per_m2'));
ALTER TABLE public.towns ADD CONSTRAINT towns_status_check CHECK (status IN ('verified','unverified'));