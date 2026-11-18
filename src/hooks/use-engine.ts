import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { DateData, StaticData } from "@/lib/data";
import { getEngineDate, getEngineDateByToken, getEngineStatic, getEngineStaticByToken } from "@/lib/public-data.functions";
import { roadDistance } from "@/lib/geo";
import type { Yard } from "@/lib/engine";

/** Engine reference data via the server (signed-in user, or a planner-link token). */
export function useStaticData(token?: string) {
  const a = useServerFn(getEngineStatic), t = useServerFn(getEngineStaticByToken);
  return useQuery({
    queryKey: ["engine-static", token ?? null],
    queryFn: async () => (token ? await t({ data: { token } }) : await a()) as StaticData,
    staleTime: 30_000,
  });
}

export function useDateData(date: string | null, token?: string) {
  const a = useServerFn(getEngineDate), t = useServerFn(getEngineDateByToken);
  return useQuery({
    queryKey: ["engine-date", date, token ?? null],
    queryFn: async () => (token ? await t({ data: { token, date: date! } }) : await a({ data: { date: date! } })) as DateData,
    enabled: !!date,
  });
}

export const useRoute = (depot: { lat: number; lon: number } | undefined, dest: { lat: number; lon: number } | null) =>
  useQuery({
    queryKey: ["route", depot?.lat, depot?.lon, dest?.lat, dest?.lon],
    queryFn: () => roadDistance(depot!, dest!),
    enabled: !!depot && !!dest,
    staleTime: Infinity,
    retry: 1,
  });

/** Road distance from every non-closed yard to the venue (per-truck travel). */
export function useYardRoutes(yards: Yard[] | undefined, dest: { lat: number; lon: number } | null) {
  const list = (yards ?? []).filter((y) => y.status !== "closed");
  const qs = useQueries({
    queries: list.map((y) => ({
      queryKey: ["route", y.lat, y.lon, dest?.lat, dest?.lon],
      queryFn: () => roadDistance(y, dest!),
      enabled: !!dest,
      staleTime: Infinity,
      retry: 1,
    })),
  });
  const done = list.length > 0 && qs.every((q) => q.isSuccess || q.isError);
  const yardKm: Record<string, number | null> = {};
  list.forEach((y, i) => (yardKm[y.id] = qs[i].data?.km ?? null));
  type Near = { yard: Yard; km: number; geometry?: [number, number][]; method: string };
  const nearest = list.reduce<Near | null>((best, y, i) => {
    const d = qs[i].data;
    return d && (!best || d.km < best.km) ? { yard: y, km: d.km, geometry: d.geometry, method: d.method } : best;
  }, null);
  return { done, loading: qs.some((q) => q.isLoading), error: done && qs.every((q) => q.isError), yardKm, nearest };
}
