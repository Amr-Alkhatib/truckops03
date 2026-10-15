import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadDateData, loadStatic } from "@/lib/data";
import { roadDistance } from "@/lib/geo";
import type { EngineConfig } from "@/lib/engine";

export const useStaticData = () =>
  useQuery({ queryKey: ["engine-static"], queryFn: () => loadStatic(supabase), staleTime: 30_000 });

export const useDateData = (date: string | null) =>
  useQuery({ queryKey: ["engine-date", date], queryFn: () => loadDateData(supabase, date!), enabled: !!date });

export const useRoute = (depot: EngineConfig["depot"] | undefined, dest: { lat: number; lon: number } | null) =>
  useQuery({
    queryKey: ["route", depot?.lat, depot?.lon, dest?.lat, dest?.lon],
    queryFn: () => roadDistance(depot!, dest!),
    enabled: !!depot && !!dest,
    staleTime: Infinity,
    retry: 1,
  });
