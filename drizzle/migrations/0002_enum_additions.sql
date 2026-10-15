ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'permit_check';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'conflict';
ALTER TYPE public.pair_rule_type ADD VALUE IF NOT EXISTS 'min_clearance_route';
ALTER TYPE public.pair_rule_type ADD VALUE IF NOT EXISTS 'never_assign';